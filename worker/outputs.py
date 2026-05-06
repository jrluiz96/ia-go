"""
Montagem de resultado e artifacts do worker.
"""
from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Any

from contract import Artifact, RunMetrics, RunStatus, WorkerOutputV1


def build_success(
    run_id: str,
    result: dict[str, Any],
    artifacts: list[Artifact],
    start_time: float,
    steps: int = 0,
) -> WorkerOutputV1:
    return WorkerOutputV1(
        run_id=run_id,
        status=RunStatus.success,
        result=result,
        artifacts=artifacts,
        metrics=RunMetrics(
            duration_ms=int((time.monotonic() - start_time) * 1000),
            steps=steps,
        ),
    )


def build_error(
    run_id: str,
    status: RunStatus,
    error_code: str,
    error_message: str,
    artifacts: list[Artifact],
    start_time: float,
    steps: int = 0,
) -> WorkerOutputV1:
    return WorkerOutputV1(
        run_id=run_id,
        status=status,
        error_code=error_code,
        error_message=error_message,
        artifacts=artifacts,
        metrics=RunMetrics(
            duration_ms=int((time.monotonic() - start_time) * 1000),
            steps=steps,
        ),
    )


def screenshot_artifact(path: Path, name: str = "screenshot.png") -> Artifact:
    """Converte screenshot em artifact base64."""
    if not path.exists():
        return Artifact(type="screenshot", name=name, content="")
    data = base64.b64encode(path.read_bytes()).decode()
    return Artifact(type="screenshot", name=name, content=data)


def html_artifact(path: Path, name: str = "page.html") -> Artifact:
    """Converte HTML salvo em artifact."""
    if not path.exists():
        return Artifact(type="html", name=name, content="")
    return Artifact(type="html", name=name, content=path.read_text(encoding="utf-8"))
