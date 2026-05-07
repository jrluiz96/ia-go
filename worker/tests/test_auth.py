"""
Testes de autenticação: resolução de credenciais com mocks.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from auth import CredentialResolutionError, resolve_credentials, sanitize_error
from contract import AuthProfile, CredentialRef


def make_auth_profile(secret_id: str = "MY_SECRET") -> AuthProfile:
    return AuthProfile(
        type="basic_login",
        credential_ref=CredentialRef(provider="env", secret_id=secret_id),
    )


class TestResolveCredentials:
    def test_sem_auth_profile(self):
        result = resolve_credentials(None, "run_001")
        assert result == {}

    def test_sem_credential_ref(self):
        profile = AuthProfile(type="basic_login", credential_ref=None)
        result = resolve_credentials(profile, "run_001")
        assert result == {}

    def test_credencial_username_password(self, monkeypatch):
        monkeypatch.setenv("MY_SECRET", "usuario:senha123")
        result = resolve_credentials(make_auth_profile("MY_SECRET"), "run_001")
        assert result["username"] == "usuario"
        assert result["password"] == "senha123"

    def test_credencial_token(self, monkeypatch):
        monkeypatch.setenv("MY_TOKEN", "eyJhbGciOiJSUzI1NiJ9.payload")
        profile = AuthProfile(
            type="bearer_token",
            credential_ref=CredentialRef(provider="env", secret_id="MY_TOKEN"),
        )
        result = resolve_credentials(profile, "run_001")
        assert "token" in result

    def test_credencial_ausente_levanta_erro(self, monkeypatch):
        monkeypatch.delenv("SECRET_INEXISTENTE", raising=False)
        monkeypatch.delenv("SECRET_SECRET_INEXISTENTE", raising=False)
        with pytest.raises(CredentialResolutionError):
            resolve_credentials(make_auth_profile("SECRET_INEXISTENTE"), "run_001")

    def test_prefixo_secret_(self, monkeypatch):
        monkeypatch.setenv("SECRET_MY_CRED", "user:pass")
        result = resolve_credentials(make_auth_profile("my_cred"), "run_001")
        assert result["username"] == "user"


class TestSanitizeError:
    def test_mascara_password(self):
        msg = "Connection failed: password=supersecret123"
        result = sanitize_error(msg)
        assert "supersecret123" not in result
        assert "[MASKED]" in result

    def test_mascara_token(self):
        msg = "Failed: token=eyJhbGciOiJSUzI1NiJ9.abc"
        result = sanitize_error(msg)
        assert "eyJhbGciOiJSUzI1NiJ9" not in result

    def test_mascara_bearer(self):
        msg = "Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.xyz.sig"
        result = sanitize_error(msg)
        assert "eyJhbGciOiJSUzI1NiJ9" not in result
        assert "[MASKED]" in result

    def test_mensagem_sem_segredo_inalterada(self):
        msg = "Timeout ao aguardar elemento #login-btn após 30s"
        result = sanitize_error(msg)
        assert result == msg

    def test_mascara_secret_dois_pontos(self):
        msg = "secret: minha_senha_ultra_secreta"
        result = sanitize_error(msg)
        assert "minha_senha_ultra_secreta" not in result

    def test_mascara_apikey(self):
        msg = "api_key=sk-abcdef1234567890"
        result = sanitize_error(msg)
        assert "sk-abcdef1234567890" not in result

    def test_string_vazia(self):
        assert sanitize_error("") == ""

    def test_multiplos_segredos(self):
        msg = "password=abc token=xyz"
        result = sanitize_error(msg)
        assert "abc" not in result
        assert "xyz" not in result

