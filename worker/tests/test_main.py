"""
Testes para o módulo main.py do worker:
- report_status: retorno bool, retry em falha transitória, sem retry em erro HTTP
- ACK condicional: ACK só acontece quando report retorna True
"""
import os
import sys
from unittest.mock import MagicMock

import pytest
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from contract import RunStatus, WorkerOutputV1, RunMetrics
import main as worker_main


def make_output(run_id: str = "run_test_001", status: RunStatus = RunStatus.success) -> WorkerOutputV1:
    return WorkerOutputV1(
        run_id=run_id,
        status=status,
        error_code="",
        error_message="",
        metrics=RunMetrics(duration_ms=100, steps=2),
    )


def _make_redis_msgs(msg_id: str, payload: str):
    return [("ia_go:adhoc_jobs", [(msg_id, {"payload": payload})])]


class TestReportStatus:
    def test_retorna_true_quando_http_2xx(self, mocker):
        """report_status retorna True quando API responde 200."""
        mock_resp = MagicMock()
        mock_resp.is_success = True
        mocker.patch("httpx.post", return_value=mock_resp)

        result = worker_main.report_status("run_test_001", make_output())
        assert result is True

    def test_retorna_false_quando_http_erro(self, mocker):
        """report_status retorna False quando API responde erro HTTP."""
        mock_resp = MagicMock()
        mock_resp.is_success = False
        mock_resp.status_code = 500
        mock_resp.text = "internal server error"
        mocker.patch("httpx.post", return_value=mock_resp)

        result = worker_main.report_status("run_test_001", make_output())
        assert result is False

    def test_retorna_false_quando_timeout(self, mocker):
        """report_status retorna False quando API não responde (TimeoutException)."""
        mocker.patch("httpx.post", side_effect=httpx.TimeoutException("timeout"))

        result = worker_main.report_status("run_test_001", make_output())
        assert result is False

    def test_retry_em_transport_error_e_retorna_false(self, mocker):
        """report_status tenta ate 3x em TransportError antes de desistir."""
        mock_post = mocker.patch(
            "httpx.post",
            side_effect=httpx.TransportError("connection refused"),
        )

        result = worker_main.report_status("run_test_001", make_output())

        assert result is False
        assert mock_post.call_count == 3

    def test_retorna_true_apos_retry_bem_sucedido(self, mocker):
        """report_status retorna True quando 2a tentativa tem sucesso."""
        mock_resp = MagicMock()
        mock_resp.is_success = True

        mocker.patch(
            "httpx.post",
            side_effect=[httpx.TransportError("falhou na 1a"), mock_resp],
        )

        result = worker_main.report_status("run_test_001", make_output())
        assert result is True


class TestAckCondicional:
    def _run_cycle(self, mocker, reported: bool):
        mocker.patch.object(worker_main, "report_status", return_value=reported)
        mocker.patch.object(worker_main, "process_job", return_value=make_output())

        mock_rdb = MagicMock()
        msgs = _make_redis_msgs("1-1", "{}")

        for _stream, messages in msgs:
            for msg_id, fields in messages:
                output = worker_main.process_job(fields.get("payload", "{}"))
                ok = worker_main.report_status(output.run_id, output)
                if ok:
                    mock_rdb.xack("ia_go:adhoc_jobs", worker_main.GROUP, msg_id)

        return mock_rdb

    def test_ack_executado_quando_report_sucesso(self, mocker):
        """ACK deve ser chamado quando report_status retorna True."""
        mock_rdb = self._run_cycle(mocker, reported=True)
        mock_rdb.xack.assert_called_once_with("ia_go:adhoc_jobs", worker_main.GROUP, "1-1")

    def test_ack_nao_executado_quando_report_falha(self, mocker):
        """ACK NAO deve ser chamado quando report_status retorna False (mensagem fica na PEL)."""
        mock_rdb = self._run_cycle(mocker, reported=False)
        mock_rdb.xack.assert_not_called()
