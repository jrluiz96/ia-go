-- Migration 001: Schema inicial IA-GO v0.1
-- Executar: psql -U ia_go_user -d ia_go -f 001_initial.sql

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- bots: definição do robô (sem código, sem credencial)
-- =============================================================
CREATE TABLE IF NOT EXISTS bots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id    VARCHAR(255) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- bot_versions: versões do código Python e contrato de execução
-- =============================================================
CREATE TABLE IF NOT EXISTS bot_versions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id        UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    version       INTEGER NOT NULL,
    code_python   TEXT NOT NULL,
    contract_json JSONB NOT NULL,
    status        VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- draft | approved | published | archived
    created_by    VARCHAR(255),
    approved_by   VARCHAR(255),
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bot_id, version),
    CONSTRAINT bot_versions_status_check CHECK (
        status IN ('draft', 'approved', 'published', 'archived')
    )
);

CREATE INDEX IF NOT EXISTS idx_bot_versions_bot_id ON bot_versions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_versions_status ON bot_versions(status);

-- =============================================================
-- bot_schedules: agendamentos por cron
-- =============================================================
CREATE TABLE IF NOT EXISTS bot_schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id      UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    cron_expr   VARCHAR(100) NOT NULL,
    timezone    VARCHAR(100) NOT NULL DEFAULT 'UTC',
    next_run_at TIMESTAMPTZ,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_schedules_bot_id ON bot_schedules(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_schedules_next_run ON bot_schedules(next_run_at) WHERE enabled = true;

-- =============================================================
-- bot_runs: execuções (agendadas e ad_hoc_test)
-- =============================================================
CREATE TABLE IF NOT EXISTS bot_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          VARCHAR(255) NOT NULL UNIQUE,
    bot_id          UUID NOT NULL REFERENCES bots(id),
    bot_version_id  UUID REFERENCES bot_versions(id),
    run_type        VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    -- scheduled | ad_hoc_test
    status          VARCHAR(50) NOT NULL DEFAULT 'queued',
    -- queued | running | success | retryable_error | fatal_error | canceled
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    last_heartbeat  TIMESTAMPTZ,
    input_json      JSONB,
    output_json     JSONB,
    error_code      VARCHAR(100),
    error_message   TEXT,
    worker_id       VARCHAR(255),
    trace_id        VARCHAR(255),
    attempt         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT bot_runs_run_type_check CHECK (
        run_type IN ('scheduled', 'ad_hoc_test')
    ),
    CONSTRAINT bot_runs_status_check CHECK (
        status IN ('queued', 'running', 'success', 'retryable_error', 'fatal_error', 'canceled')
    )
);

CREATE INDEX IF NOT EXISTS idx_bot_runs_run_id       ON bot_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_bot_runs_bot_id       ON bot_runs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_runs_status       ON bot_runs(status);
CREATE INDEX IF NOT EXISTS idx_bot_runs_created_at   ON bot_runs(created_at DESC);

-- =============================================================
-- run_events: log estruturado por execução
-- =============================================================
CREATE TABLE IF NOT EXISTS run_events (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id    VARCHAR(255) NOT NULL,
    ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level     VARCHAR(20) NOT NULL DEFAULT 'info',
    -- debug | info | warn | error
    message   TEXT NOT NULL,
    data_json JSONB,
    CONSTRAINT run_events_level_check CHECK (
        level IN ('debug', 'info', 'warn', 'error')
    )
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_run_events_ts     ON run_events(ts DESC);
