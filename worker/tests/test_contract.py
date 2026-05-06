"""
Testes de contrato: validação de entrada e saída do worker v1.
"""
import pytest
from pydantic import ValidationError

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from contract import (
    ContractV1,
    RunStatus,
    RunType,
    WorkerOutputV1,
    ExecutionContext,
    RetryPolicy,
    TraceInfo,
)


def make_valid_contract(**overrides) -> dict:
    base = {
        "contract_version": "1.0",
        "run_id": "run_test_001",
        "bot_id": "bot_example",
        "bot_version": 1,
        "run_type": "ad_hoc_test",
        "params": {"base_url": "https://example.com"},
        "execution_context": {
            "timeout_sec": 120,
            "capabilities": ["web_headless"],
            "worker_type": "linux_headless",
        },
        "retry_policy": {"max_attempts": 1, "backoff_sec": 0, "retry_on": "retryable_error"},
        "trace": {"trace_id": "trace_abc", "run_id": "run_test_001"},
    }
    base.update(overrides)
    return base


class TestContractV1:
    def test_valido_completo(self):
        c = ContractV1.model_validate(make_valid_contract())
        assert c.run_id == "run_test_001"
        assert c.run_type == RunType.ad_hoc_test
        assert c.execution_context.timeout_sec == 120
        assert c.retry_policy.max_attempts == 1

    def test_run_type_scheduled(self):
        c = ContractV1.model_validate(make_valid_contract(run_type="scheduled"))
        assert c.run_type == RunType.scheduled

    def test_run_id_obrigatorio(self):
        data = make_valid_contract()
        del data["run_id"]
        with pytest.raises(ValidationError):
            ContractV1.model_validate(data)

    def test_bot_id_obrigatorio(self):
        data = make_valid_contract()
        del data["bot_id"]
        with pytest.raises(ValidationError):
            ContractV1.model_validate(data)

    def test_timeout_minimo(self):
        data = make_valid_contract()
        data["execution_context"]["timeout_sec"] = 5  # abaixo do mínimo 10
        with pytest.raises(ValidationError):
            ContractV1.model_validate(data)

    def test_max_attempts_limite(self):
        data = make_valid_contract()
        data["retry_policy"]["max_attempts"] = 0  # abaixo do mínimo 1
        with pytest.raises(ValidationError):
            ContractV1.model_validate(data)

    def test_run_type_invalido(self):
        with pytest.raises(ValidationError):
            ContractV1.model_validate(make_valid_contract(run_type="invalido"))

    def test_defaults_execution_context(self):
        data = make_valid_contract()
        del data["execution_context"]
        c = ContractV1.model_validate(data)
        assert c.execution_context.timeout_sec == 120
        assert c.execution_context.worker_type == "linux_headless"

    def test_sem_auth_profile(self):
        c = ContractV1.model_validate(make_valid_contract())
        assert c.auth_profile is None


class TestWorkerOutputV1:
    def test_sucesso(self):
        out = WorkerOutputV1(
            run_id="run_001",
            status=RunStatus.success,
            result={"items": 5},
        )
        assert out.status == RunStatus.success
        assert out.error_code == ""

    def test_fatal_error(self):
        out = WorkerOutputV1(
            run_id="run_001",
            status=RunStatus.fatal_error,
            error_code="ERR_LOGIN",
            error_message="Login falhou",
        )
        assert out.status == RunStatus.fatal_error
        assert out.error_code == "ERR_LOGIN"

    def test_retryable_error(self):
        out = WorkerOutputV1(
            run_id="run_001",
            status=RunStatus.retryable_error,
            error_code="ERR_TIMEOUT",
            error_message="Timeout de navegação",
        )
        assert out.status == RunStatus.retryable_error

    def test_sem_segredo_no_output(self):
        """Garante que resultado não contém campos de credencial."""
        out = WorkerOutputV1(
            run_id="run_001",
            status=RunStatus.success,
            result={"data": "valor"},
        )
        dump = out.model_dump_json()
        assert "password" not in dump
        assert "secret_id" not in dump
        assert "token" not in dump

    def test_artifacts_vazios_por_default(self):
        out = WorkerOutputV1(run_id="run_001", status=RunStatus.success)
        assert out.artifacts == []
        assert out.metrics.duration_ms == 0
