"""
Teste de fluxo feliz do runner (sem Playwright real — usa mock de page).
"""
import os
import sys
import time
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from contract import ContractV1, RunStatus
from runner import run


def make_contract() -> ContractV1:
    return ContractV1.model_validate({
        "contract_version": "1.0",
        "run_id": "run_happy_001",
        "bot_id": "bot_test",
        "bot_version": 1,
        "run_type": "ad_hoc_test",
        "params": {"base_url": "https://example.com"},
        "execution_context": {
            "timeout_sec": 30,
            "capabilities": ["web_headless"],
            "worker_type": "linux_headless",
        },
        "retry_policy": {"max_attempts": 1, "backoff_sec": 0, "retry_on": "retryable_error"},
        "trace": {"trace_id": "trace_happy", "run_id": "run_happy_001"},
    })


class TestRunnerHappyPath:
    def test_sucesso(self, mocker):
        """Runner retorna success quando steps_fn executa sem erro."""
        # Mock do Playwright
        mock_page = MagicMock()
        mock_browser = MagicMock()
        mock_context_obj = MagicMock()
        mock_context_obj.new_page.return_value = mock_page
        mock_browser.new_context.return_value = mock_context_obj

        mock_pw = MagicMock()
        mock_pw.__enter__ = MagicMock(return_value=mock_pw)
        mock_pw.__exit__ = MagicMock(return_value=False)
        mock_pw.chromium.launch.return_value = mock_browser

        mocker.patch("runner.sync_playwright", return_value=mock_pw)

        def steps_fn(page, contract, creds):
            return {"items_coletados": 10}

        contract = make_contract()
        output = run(contract, steps_fn)

        assert output.status == RunStatus.success
        assert output.run_id == "run_happy_001"
        assert output.result == {"items_coletados": 10}
        assert output.error_code == ""
        assert output.metrics.duration_ms >= 0

    def test_fatal_error_em_steps(self, mocker):
        """Runner mapeia exceção não tratada para fatal_error."""
        mock_pw = MagicMock()
        mock_pw.__enter__ = MagicMock(return_value=mock_pw)
        mock_pw.__exit__ = MagicMock(return_value=False)
        mock_browser = MagicMock()
        mock_context_obj = MagicMock()
        mock_context_obj.new_page.return_value = MagicMock()
        mock_browser.new_context.return_value = mock_context_obj
        mock_pw.chromium.launch.return_value = mock_browser

        mocker.patch("runner.sync_playwright", return_value=mock_pw)

        def steps_fn(page, contract, creds):
            raise RuntimeError("Elemento não encontrado")

        output = run(make_contract(), steps_fn)

        assert output.status == RunStatus.fatal_error
        assert output.error_code == "ERR_EXECUTION"
        assert "Elemento não encontrado" in output.error_message

    def test_credencial_invalida(self, mocker):
        """Runner retorna fatal_error quando credencial não pode ser resolvida."""
        from contract import AuthProfile, CredentialRef

        mocker.patch.dict(os.environ, {}, clear=False)
        # Remove a variável para forçar erro
        for key in list(os.environ.keys()):
            if "MINHA_CRED" in key:
                del os.environ[key]

        contract = make_contract()
        contract.auth_profile = AuthProfile(
            type="basic_login",
            credential_ref=CredentialRef(provider="env", secret_id="MINHA_CRED_INEXISTENTE"),
        )

        output = run(contract, lambda p, c, cr: {})

        assert output.status == RunStatus.fatal_error
        assert output.error_code == "ERR_CREDENTIAL_RESOLUTION"
