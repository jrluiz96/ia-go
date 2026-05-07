"""
Modelos Pydantic do contrato de execução v1 (Go <-> Worker Python).
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RunType(str, Enum):
    scheduled = "scheduled"
    ad_hoc_test = "ad_hoc_test"


class RunStatus(str, Enum):
    queued = "queued"
    running = "running"
    success = "success"
    retryable_error = "retryable_error"
    fatal_error = "fatal_error"
    canceled = "canceled"


class CredentialRef(BaseModel):
    provider: str
    secret_id: str


class AuthProfile(BaseModel):
    type: str
    credential_ref: CredentialRef | None = None


class ExecutionContext(BaseModel):
    timeout_sec: int = Field(default=120, ge=10, le=3600)
    capabilities: list[str] = Field(default_factory=list)
    worker_type: str = "linux_headless"


class RetryPolicy(BaseModel):
    max_attempts: int = Field(default=1, ge=1, le=10)
    backoff_sec: int = Field(default=30, ge=0)
    retry_on: str = "retryable_error"


class TraceInfo(BaseModel):
    trace_id: str
    run_id: str


class ContractV1(BaseModel):
    """Envelope de entrada: Go -> Worker Python."""
    contract_version: str = "1.0"
    run_id: str
    bot_id: str
    bot_version: int = 1
    run_type: RunType
    params: dict[str, Any] = Field(default_factory=dict)
    auth_profile: AuthProfile | None = None
    execution_context: ExecutionContext = Field(default_factory=ExecutionContext)
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)
    trace: TraceInfo


class Artifact(BaseModel):
    type: str  # screenshot | html | json | log
    name: str
    content: str | None = None
    url: str | None = None


class RunMetrics(BaseModel):
    duration_ms: int = 0
    steps: int = 0


class WorkerOutputV1(BaseModel):
    """Envelope de saída: Worker Python -> Go."""
    run_id: str
    status: RunStatus
    result: dict[str, Any] | None = None
    artifacts: list[Artifact] = Field(default_factory=list)
    error_code: str = ""
    error_message: str = ""
    metrics: RunMetrics = Field(default_factory=RunMetrics)
