"""
Worker principal: consome jobs do Redis Streams e executa bots.
Suporta ad_hoc_test e scheduled via contract v1.
"""
from __future__ import annotations

import importlib
import importlib.util
import json
import logging
import os
import signal
import time
import uuid
from typing import Any

import httpx
import redis
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from contract import ContractV1, RunStatus, WorkerOutputV1
from outputs import build_error

# Configuração de log estruturado
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)

log = structlog.get_logger()

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
STREAM_ADHOC = "ia_go:adhoc_jobs"
STREAM_SCHEDULED = "ia_go:scheduled_jobs"
GROUP = "ia_go_workers"
WORKER_ID = f"worker_{uuid.uuid4().hex[:8]}"

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080")


def connect_redis() -> redis.Redis:
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD or None,
        decode_responses=True,
    )


def ensure_groups(rdb: redis.Redis) -> None:
    for stream in (STREAM_ADHOC, STREAM_SCHEDULED):
        try:
            rdb.xgroup_create(stream, GROUP, id="0", mkstream=True)
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise


def report_status(run_id: str, output: WorkerOutputV1) -> bool:
    """Chama a API Go para atualizar o status da run.

    Retorna True se o reporte foi persistido com sucesso (HTTP 2xx),
    False em qualquer outra situação (após retentativas).
    """
    url = f"{API_BASE_URL}/api/v1/runs/{run_id}/status"

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def _post() -> httpx.Response:
        return httpx.post(url, json=output.model_dump(), timeout=10)

    try:
        resp = _post()
        if resp.is_success:
            log.info("worker.status_reportado", run_id=run_id, status=output.status)
            return True
        log.error(
            "worker.falha_ao_reportar_status",
            run_id=run_id,
            http_status=resp.status_code,
            body=resp.text[:200],
        )
        return False
    except Exception as exc:  # noqa: BLE001
        log.error("worker.falha_ao_reportar_status", run_id=run_id, error=str(exc))
        return False


def process_job(payload_raw: str) -> WorkerOutputV1:
    """Processa um job a partir do payload JSON da fila."""
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError as exc:
        return WorkerOutputV1(
            run_id="unknown",
            status=RunStatus.fatal_error,
            error_code="ERR_INVALID_PAYLOAD",
            error_message=str(exc),
        )

    run_id = payload.get("run_id", "unknown")
    bot_id = payload.get("bot_id", "")
    run_type = payload.get("run_type", "scheduled")
    params = payload.get("params") or {}
    trace_id = payload.get("trace_id", str(uuid.uuid4()))
    timeout_sec = payload.get("timeout_sec", 120)

    bound_log = log.bind(run_id=run_id, bot_id=bot_id)
    bound_log.info("worker.processando_job", run_type=run_type)

    # Usa contrato v1 publicado pelo backend quando disponível (scheduled runs).
    # Fallback para contrato mínimo em ad_hoc_test (sem contrato armazenado).
    contract_json_raw = payload.get("contract_json")
    if contract_json_raw:
        try:
            if isinstance(contract_json_raw, str):
                contract_data = json.loads(contract_json_raw)
            else:
                contract_data = dict(contract_json_raw)
            # Sobrepõe campos de runtime que o backend conhece melhor
            contract_data["run_id"] = run_id
            contract_data["bot_id"] = bot_id
            contract_data["run_type"] = run_type
            contract_data["trace"] = {"trace_id": trace_id, "run_id": run_id}
            if params:
                contract_data["params"] = params
            bound_log.info("worker.usando_contrato_publicado", version=contract_data.get("contract_version"))
        except (json.JSONDecodeError, TypeError) as exc:
            bound_log.warning("worker.falha_ao_parsear_contract_json", error=str(exc))
            contract_json_raw = None  # fallback para mínimo

    if not contract_json_raw:
        # Contrato mínimo para execuções sem contrato armazenado (ad_hoc_test)
        contract_data = {
            "contract_version": "1.0",
            "run_id": run_id,
            "bot_id": bot_id,
            "bot_version": 1,
            "run_type": run_type,
            "params": params,
            "execution_context": {
                "timeout_sec": timeout_sec,
                "capabilities": ["web_headless"],
                "worker_type": "linux_headless",
            },
            "retry_policy": {
                "max_attempts": 1 if run_type == "ad_hoc_test" else 3,
                "backoff_sec": 0 if run_type == "ad_hoc_test" else 30,
                "retry_on": "retryable_error",
            },
            "trace": {
                "trace_id": trace_id,
                "run_id": run_id,
            },
        }

    try:
        contract = ContractV1.model_validate(contract_data)
    except Exception as exc:  # noqa: BLE001
        bound_log.error("worker.contrato_invalido", error=str(exc))
        return WorkerOutputV1(
            run_id=run_id,
            status=RunStatus.fatal_error,
            error_code="ERR_CONTRACT_VALIDATION",
            error_message=str(exc),
        )

    # Tenta carregar o módulo do bot pelo bot_id
    # Convenção: bots/<bot_id>/main.py com função execute_steps(page, contract, credentials) -> dict
    # Se o contrato contiver generated_files, escreve em /tmp/bots/ antes de importar
    bot_module_name = f"bots.{bot_id.replace('-', '_')}.main"

    generated_files: dict = contract_data.get("generated_files") or {}
    if generated_files:
        import sys
        import os

        bot_dir = f"/tmp/bots/{bot_id.replace('-', '_')}"
        os.makedirs(bot_dir, exist_ok=True)

        # Escreve __init__.py e todos os arquivos gerados
        bots_init = os.path.join("/tmp/bots", "__init__.py")
        if not os.path.exists(bots_init):
            open(bots_init, "w").close()
        open(os.path.join(bot_dir, "__init__.py"), "w").close()

        for fname, content in generated_files.items():
            fpath = os.path.join(bot_dir, fname)
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            bound_log.info("worker.arquivo_escrito", path=fpath)

        # Carrega o bot usando spec_from_file_location para isolar o módulo
        # e evitar que imports como "from contract import ..." resolvam para
        # o contract.py do worker em vez do contract.py gerado do bot.
        main_path = os.path.join(bot_dir, "main.py")
        if not os.path.exists(main_path):
            bound_log.error("worker.main_py_ausente", bot_dir=bot_dir,
                            arquivos=list(generated_files.keys()))
            return build_error(
                run_id=run_id,
                status=RunStatus.fatal_error,
                error_code="ERR_BOT_NO_MAIN",
                error_message=f"main.py não encontrado em generated_files. "
                              f"Arquivos disponíveis: {list(generated_files.keys())}",
                artifacts=[],
                start_time=time.monotonic(),
            )

        # Remove módulos em cache do bot para forçar recarga limpa
        for key in list(sys.modules.keys()):
            if key.startswith(f"bots.{bot_id.replace('-', '_')}"):
                del sys.modules[key]

        # Garante que o diretório do bot está na frente do sys.path
        # para que imports relativos dentro do bot (from contract import ...)
        # resolvam para os arquivos locais do bot, não os do worker.
        if bot_dir in sys.path:
            sys.path.remove(bot_dir)
        sys.path.insert(0, bot_dir)

        try:
            spec = importlib.util.spec_from_file_location(bot_module_name, main_path)
            bot_module = importlib.util.module_from_spec(spec)
            sys.modules[bot_module_name] = bot_module
            spec.loader.exec_module(bot_module)
            steps_fn = getattr(bot_module, "execute_steps")
        except Exception as exc:
            bound_log.error("worker.bot_load_error", error=str(exc))
            return build_error(
                run_id=run_id,
                status=RunStatus.fatal_error,
                error_code="ERR_BOT_LOAD",
                error_message=f"Erro ao carregar bot de {main_path}: {exc}",
                artifacts=[],
                start_time=time.monotonic(),
            )
        finally:
            # Restaura sys.path removendo o dir do bot — evita conflitos em runs futuras
            if bot_dir in sys.path:
                sys.path.remove(bot_dir)
    else:
        # Sem generated_files: tenta importar de bots/ estático (modo produção)
        import sys
        import os
        if "/tmp" not in sys.path:
            sys.path.insert(0, "/tmp")
        try:
            bot_module = importlib.import_module(bot_module_name)
            steps_fn = getattr(bot_module, "execute_steps")
        except (ImportError, AttributeError) as exc:
            bound_log.error("worker.bot_nao_encontrado", error=str(exc))
            return build_error(
                run_id=run_id,
                status=RunStatus.fatal_error,
                error_code="ERR_BOT_NOT_FOUND",
                error_message=f"Módulo do bot não encontrado: {bot_module_name}. Detalhes: {exc}",
                artifacts=[],
                start_time=time.monotonic(),
            )

    import runner as runner_module
    return _execute_with_retry(contract, steps_fn, bound_log)


def _execute_with_retry(
    contract: ContractV1,
    steps_fn: object,
    bound_log: object,
) -> WorkerOutputV1:
    """Executa o bot respeitando retry_policy do contrato.

    - retry_on (do contrato): status que aciona reexecução com backoff
    - qualquer outro status: encerra imediatamente
    - ad_hoc_test: max_attempts fixo em 1 (sem retry)
    """
    import runner as runner_module

    max_attempts = contract.retry_policy.max_attempts
    backoff_sec = contract.retry_policy.backoff_sec

    # Status que aciona retry é configurável pelo contrato; fallback seguro se valor inválido
    try:
        retry_on_status = RunStatus(contract.retry_policy.retry_on)
    except ValueError:
        bound_log.warning(
            "worker.retry_on_invalido",
            retry_on=contract.retry_policy.retry_on,
            fallback=RunStatus.retryable_error.value,
        )
        retry_on_status = RunStatus.retryable_error

    # ad_hoc_test nunca retenta
    if contract.run_type.value == "ad_hoc_test":
        max_attempts = 1

    last_output: WorkerOutputV1 | None = None

    for attempt in range(1, max_attempts + 1):
        if attempt > 1:
            bound_log.info(
                "worker.retry",
                attempt=attempt,
                max_attempts=max_attempts,
                backoff_sec=backoff_sec,
                retry_on=retry_on_status.value,
            )
            time.sleep(backoff_sec)

        output = runner_module.run(contract, steps_fn)
        last_output = output

        if output.status != retry_on_status:
            bound_log.info("worker.execucao_encerrada", status=output.status, attempt=attempt)
            return output

        bound_log.warning(
            "worker.retryable_error",
            attempt=attempt,
            max_attempts=max_attempts,
            error_code=output.error_code,
        )

    # Esgotou tentativas: promove para fatal_error
    bound_log.error(
        "worker.max_attempts_esgotado",
        max_attempts=max_attempts,
        error_code=last_output.error_code if last_output else "",
    )
    return WorkerOutputV1(
        run_id=contract.run_id,
        status=RunStatus.fatal_error,
        error_code="ERR_MAX_ATTEMPTS",
        error_message=f"Máximo de {max_attempts} tentativas atingido. Último erro: "
                      f"{last_output.error_code if last_output else 'unknown'}",
        metrics=last_output.metrics if last_output else None,
        artifacts=last_output.artifacts if last_output else [],
    )


def main() -> None:
    log.info("worker.iniciando", worker_id=WORKER_ID)
    rdb = connect_redis()
    ensure_groups(rdb)
    log.info("worker.aguardando_jobs", streams=[STREAM_ADHOC, STREAM_SCHEDULED])

    running = True

    def handle_stop(sig, _frame):
        nonlocal running
        log.info("worker.encerrando", signal=sig)
        running = False

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    while running:
        for stream in (STREAM_ADHOC, STREAM_SCHEDULED):
            try:
                msgs = rdb.xreadgroup(
                    GROUP, WORKER_ID, {stream: ">"}, count=1, block=2000
                )
            except redis.exceptions.ResponseError:
                time.sleep(1)
                continue

            if not msgs:
                continue

            for _stream, messages in msgs:
                for msg_id, fields in messages:
                    payload_raw = fields.get("payload", "{}")
                    output = process_job(payload_raw)
                    reported = report_status(output.run_id, output)
                    if reported:
                        rdb.xack(stream, GROUP, msg_id)
                        log.info(
                            "worker.job_processado",
                            msg_id=msg_id,
                            run_id=output.run_id,
                            status=output.status,
                        )
                    else:
                        # Mantém na PEL para reclamação/retry; outro worker pode
                        # reclamar via XAUTOCLAIM após idle-time configurado.
                        log.warning(
                            "worker.ack_suspenso_por_falha_de_reporte",
                            msg_id=msg_id,
                            run_id=output.run_id,
                        )


if __name__ == "__main__":
    main()
