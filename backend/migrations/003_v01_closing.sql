-- Migration 003: Fechamento v0.1 — Rollback de versão
-- Aplicar: Get-Content migrations/003_v01_closing.sql | docker exec -i ia-go-postgres-1 psql -U ia_go_user -d ia_go

-- Índice composto para consultas de rollback (busca por bot_id + status archived/approved)
CREATE INDEX IF NOT EXISTS idx_bot_versions_bot_status
    ON bot_versions(bot_id, status);

-- Comentário de documentação no CHECK constraint (re-aplica para garantir que 'archived' consta)
-- O constraint original já cobre 'archived'; migration é idempotente.
DO $$
BEGIN
    -- Valida que o constraint de status já inclui archived
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'bot_versions_status_check'
    ) THEN
        ALTER TABLE bot_versions
            ADD CONSTRAINT bot_versions_status_check
            CHECK (status IN ('draft', 'approved', 'published', 'archived'));
    END IF;
END $$;
