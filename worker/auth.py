"""
Resolução de credenciais e autenticação.
Nunca retorna segredo no output. Usa apenas credential_ref/secret_id.
"""
from __future__ import annotations

import os
from typing import Any

import structlog

from contract import AuthProfile

log = structlog.get_logger()


class CredentialResolutionError(Exception):
    """Erro fatal ao resolver credencial."""


def resolve_credentials(auth_profile: AuthProfile | None, run_id: str) -> dict[str, Any]:
    """
    Resolve credenciais a partir do auth_profile usando a variável de ambiente
    ou o secret provider configurado.

    Retorna um dicionário com as credenciais resolvidas (username/password/token).
    NUNCA inclui o valor no log.
    """
    if auth_profile is None:
        log.info("auth.sem_perfil", run_id=run_id)
        return {}

    ref = auth_profile.credential_ref
    if ref is None:
        log.info("auth.sem_credential_ref", run_id=run_id, type=auth_profile.type)
        return {}

    log.info(
        "auth.resolvendo_credencial",
        run_id=run_id,
        provider=ref.provider,
        secret_id=ref.secret_id,
    )

    # Resolução por variável de ambiente (desenvolvimento local)
    # Em produção, substituir pela integração com o secret provider real.
    env_key = ref.secret_id.upper().replace("-", "_").replace("/", "_")
    raw = os.environ.get(env_key)

    if raw is None:
        # Tentativa alternativa com prefixo SECRET_
        raw = os.environ.get(f"SECRET_{env_key}")

    if raw is None:
        raise CredentialResolutionError(
            f"Credencial '{ref.secret_id}' não encontrada "
            f"(provider={ref.provider}). "
            "Verifique se o secret_id está correto e o provider está configurado."
        )

    # Formato esperado na env var: "username:password" ou só o token
    if ":" in raw:
        username, _, password = raw.partition(":")
        return {"username": username, "password": password}

    return {"token": raw}
