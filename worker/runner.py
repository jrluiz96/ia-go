"""
Runner base — fluxo principal de execução do worker.
Cada bot implementa execute_steps(page, contract, credentials) -> dict.
"""
from __future__ import annotations

import os
import threading
import time
from typing import Any, Callable

import httpx
import structlog
from playwright.sync_api import Browser, Page, sync_playwright

from auth import CredentialResolutionError, resolve_credentials
from contract import ContractV1, RunStatus, WorkerOutputV1
from outputs import build_error, build_success

log = structlog.get_logger()

# Tipo do callable de steps que cada bot fornece
StepsFn = Callable[[Page, ContractV1, dict[str, Any]], dict[str, Any]]

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080")
_HEARTBEAT_INTERVAL_SEC = 30


class _HeartbeatThread(threading.Thread):
    """Thread daemon que envia heartbeat para a API enquanto o bot executa."""

    def __init__(self, run_id: str) -> None:
        super().__init__(daemon=True, name=f"heartbeat-{run_id[:8]}")
        self._run_id = run_id
        self._stop_event = threading.Event()

    def run(self) -> None:
        url = f"{API_BASE_URL}/api/v1/runs/{self._run_id}/heartbeat"
        while not self._stop_event.wait(timeout=_HEARTBEAT_INTERVAL_SEC):
            try:
                httpx.post(url, timeout=5)
            except Exception as exc:  # noqa: BLE001
                log.warning("runner.heartbeat_falhou", run_id=self._run_id, error=str(exc))

    def stop(self) -> None:
        self._stop_event.set()


def run(contract: ContractV1, steps_fn: StepsFn) -> WorkerOutputV1:
    """
    Executa o bot seguindo o contrato v1.

    1. Resolve credenciais.
    2. Abre browser headless.
    3. Chama steps_fn com a página e as credenciais.
    4. Retorna WorkerOutputV1 padronizado.
    """
    bound_log = log.bind(run_id=contract.run_id, trace_id=contract.trace.trace_id)
    start = time.monotonic()
    artifacts = []

    bound_log.info("runner.iniciando", bot_id=contract.bot_id, run_type=contract.run_type)

    # --- Resolução de credenciais ---
    try:
        credentials = resolve_credentials(contract.auth_profile, contract.run_id)
    except CredentialResolutionError as exc:
        bound_log.error("runner.credencial_invalida", error=str(exc))
        return build_error(
            run_id=contract.run_id,
            status=RunStatus.fatal_error,
            error_code="ERR_CREDENTIAL_RESOLUTION",
            error_message=str(exc),
            artifacts=artifacts,
            start_time=start,
        )

    # --- Heartbeat thread ---
    hb = _HeartbeatThread(contract.run_id)
    hb.start()
    bound_log.info("runner.heartbeat_iniciado", interval_sec=_HEARTBEAT_INTERVAL_SEC)

    # --- Execução com Playwright ---
    timeout_ms = contract.execution_context.timeout_sec * 1000

    try:
        with sync_playwright() as pw:
            browser: Browser = pw.chromium.launch(headless=True)
            context = browser.new_context()
            context.set_default_timeout(timeout_ms)
            page: Page = context.new_page()

            bound_log.info("runner.browser_aberto")

            result = steps_fn(page, contract, credentials)

            browser.close()
            bound_log.info("runner.concluido_com_sucesso")

        hb.stop()
        return build_success(
            run_id=contract.run_id,
            result=result,
            artifacts=artifacts,
            start_time=start,
        )

    except TimeoutError as exc:
        hb.stop()
        bound_log.error("runner.timeout", error=str(exc))
        return build_error(
            run_id=contract.run_id,
            status=RunStatus.retryable_error,
            error_code="ERR_TIMEOUT",
            error_message=f"Timeout após {contract.execution_context.timeout_sec}s: {exc}",
            artifacts=artifacts,
            start_time=start,
        )
    except Exception as exc:  # noqa: BLE001
        hb.stop()
        bound_log.error("runner.erro_fatal", error=str(exc), exc_info=True)
        return build_error(
            run_id=contract.run_id,
            status=RunStatus.fatal_error,
            error_code="ERR_EXECUTION",
            error_message=str(exc),
            artifacts=artifacts,
            start_time=start,
        )
