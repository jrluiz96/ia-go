-- Migration 002: Sprint 3 — Publicação + Runtime
-- Aplicar: Get-Content migrations/002_sprint3.sql | docker exec -i ia-go-postgres-1 psql -U ia_go_user -d ia_go

-- Apenas 1 versão published por bot ao mesmo tempo
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_versions_one_published
    ON bot_versions(bot_id) WHERE status = 'published';

-- Auditoria: quando a versão foi aprovada
ALTER TABLE bot_versions
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Índice para scheduler: busca eficiente de agendamentos vencidos
CREATE INDEX IF NOT EXISTS idx_bot_schedules_due
    ON bot_schedules(next_run_at ASC)
    WHERE enabled = true AND next_run_at IS NOT NULL;
