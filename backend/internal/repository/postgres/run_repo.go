package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"ia-go/backend/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RunRepo struct {
	db *pgxpool.Pool
}

func NewRunRepo(db *pgxpool.Pool) *RunRepo {
	return &RunRepo{db: db}
}

func (r *RunRepo) Create(ctx context.Context, run *domain.BotRun) (*domain.BotRun, error) {
	inputBytes, _ := json.Marshal(run.InputJSON)

	const q = `
		INSERT INTO bot_runs (run_id, bot_id, bot_version_id, run_type, status, scheduled_at, input_json, trace_id, attempt)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(ctx, q,
		run.RunID, run.BotID, run.BotVersionID,
		run.RunType, run.Status, run.ScheduledAt,
		inputBytes, run.TraceID, run.Attempt,
	).Scan(&run.ID, &run.CreatedAt, &run.UpdatedAt)

	return run, err
}

func (r *RunRepo) GetByRunID(ctx context.Context, runID string) (*domain.BotRun, error) {
	const q = `
		SELECT id, run_id, bot_id, bot_version_id, run_type, status,
		       scheduled_at, started_at, finished_at, last_heartbeat,
		       input_json, output_json, error_code, error_message,
		       worker_id, trace_id, attempt, created_at, updated_at
		FROM bot_runs WHERE run_id = $1`

	run := &domain.BotRun{}
	var inputRaw, outputRaw []byte
	var botVersionID *uuid.UUID
	var errorCode, errorMessage, workerID sql.NullString

	err := r.db.QueryRow(ctx, q, runID).Scan(
		&run.ID, &run.RunID, &run.BotID, &botVersionID, &run.RunType, &run.Status,
		&run.ScheduledAt, &run.StartedAt, &run.FinishedAt, &run.LastHeartbeat,
		&inputRaw, &outputRaw, &errorCode, &errorMessage,
		&workerID, &run.TraceID, &run.Attempt, &run.CreatedAt, &run.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	run.BotVersionID = botVersionID
	run.ErrorCode = errorCode.String
	run.ErrorMessage = errorMessage.String
	run.WorkerID = workerID.String
	if inputRaw != nil {
		_ = json.Unmarshal(inputRaw, &run.InputJSON)
	}
	if outputRaw != nil {
		_ = json.Unmarshal(outputRaw, &run.OutputJSON)
	}

	return run, nil
}

func (r *RunRepo) ListByBotID(ctx context.Context, botID uuid.UUID, limit int) ([]*domain.BotRun, error) {
	const q = `
		SELECT id, run_id, bot_id, bot_version_id, run_type, status,
		       scheduled_at, started_at, finished_at,
		       error_code, error_message, trace_id, attempt, created_at
		FROM bot_runs WHERE bot_id = $1
		ORDER BY created_at DESC LIMIT $2`

	rows, err := r.db.Query(ctx, q, botID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []*domain.BotRun
	for rows.Next() {
		run := &domain.BotRun{}
		var botVersionID *uuid.UUID
		var errorCode, errorMessage sql.NullString
		if err := rows.Scan(
			&run.ID, &run.RunID, &run.BotID, &botVersionID, &run.RunType, &run.Status,
			&run.ScheduledAt, &run.StartedAt, &run.FinishedAt,
			&errorCode, &errorMessage, &run.TraceID, &run.Attempt, &run.CreatedAt,
		); err != nil {
			return nil, err
		}
		run.BotVersionID = botVersionID
		run.ErrorCode = errorCode.String
		run.ErrorMessage = errorMessage.String
		runs = append(runs, run)
	}
	return runs, nil
}

func (r *RunRepo) UpdateStatus(ctx context.Context, runID string, status domain.RunStatus, output *domain.WorkerOutputV1) error {
	var outputBytes []byte
	if output != nil {
		outputBytes, _ = json.Marshal(output)
	}

	const q = `
		UPDATE bot_runs
		SET status = $1,
		    output_json = $2,
		    error_code = $3,
		    error_message = $4,
		    finished_at = CASE WHEN $5 IN ('success','fatal_error','canceled') THEN NOW() ELSE finished_at END,
		    started_at  = CASE WHEN $5 = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
		    updated_at  = NOW()
		WHERE run_id = $6`

	errCode := ""
	errMsg := ""
	if output != nil {
		errCode = output.ErrorCode
		errMsg = output.ErrorMessage
	}

	_, err := r.db.Exec(ctx, q, status, outputBytes, errCode, errMsg, string(status), runID)
	return err
}

func mapsClone(input map[string]interface{}) map[string]interface{} {
	if input == nil {
		return map[string]interface{}{}
	}

	cloned := make(map[string]interface{}, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}

func (r *RunRepo) AppendEvent(ctx context.Context, event *domain.RunEvent) error {
	var dataBytes []byte
	if event.DataJSON != nil {
		dataBytes, _ = json.Marshal(event.DataJSON)
	}

	const q = `
		INSERT INTO run_events (run_id, ts, level, message, data_json)
		VALUES ($1, NOW(), $2, $3, $4)`

	_, err := r.db.Exec(ctx, q, event.RunID, event.Level, event.Message, dataBytes)
	return err
}

func (r *RunRepo) ListEvents(ctx context.Context, runID string) ([]*domain.RunEvent, error) {
	const q = `
		SELECT id, run_id, ts, level, message, data_json
		FROM run_events WHERE run_id = $1 ORDER BY ts ASC`

	rows, err := r.db.Query(ctx, q, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*domain.RunEvent
	for rows.Next() {
		e := &domain.RunEvent{}
		var dataRaw []byte
		if err := rows.Scan(&e.ID, &e.RunID, &e.Ts, &e.Level, &e.Message, &dataRaw); err != nil {
			return nil, err
		}
		if dataRaw != nil {
			_ = json.Unmarshal(dataRaw, &e.DataJSON)
		}
		events = append(events, e)
	}
	return events, nil
}

// UpdateHeartbeat atualiza last_heartbeat da run para NOW().
func (r *RunRepo) UpdateHeartbeat(ctx context.Context, runID string) error {
	const q = `UPDATE bot_runs SET last_heartbeat = NOW(), updated_at = NOW() WHERE run_id = $1`
	_, err := r.db.Exec(ctx, q, runID)
	return err
}

// GetStuckRuns retorna runs em status 'running' cujo last_heartbeat é mais antigo
// que o threshold informado (ou NULL), indicando possível travamento.
func (r *RunRepo) GetStuckRuns(ctx context.Context, olderThan time.Duration) ([]*domain.BotRun, error) {
	const q = `
		SELECT id, run_id, bot_id, bot_version_id, run_type, status,
		       scheduled_at, started_at, finished_at,
		       error_code, error_message, trace_id, attempt, created_at
		FROM bot_runs
		WHERE status = 'running'
		  AND (last_heartbeat IS NULL OR last_heartbeat < NOW() - $1::interval)
		ORDER BY started_at ASC`

	rows, err := r.db.Query(ctx, q, olderThan.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []*domain.BotRun
	for rows.Next() {
		run := &domain.BotRun{}
		var botVersionID *uuid.UUID
		var errorCode, errorMessage sql.NullString
		if err := rows.Scan(
			&run.ID, &run.RunID, &run.BotID, &botVersionID, &run.RunType, &run.Status,
			&run.ScheduledAt, &run.StartedAt, &run.FinishedAt,
			&errorCode, &errorMessage, &run.TraceID, &run.Attempt, &run.CreatedAt,
		); err != nil {
			return nil, err
		}
		run.BotVersionID = botVersionID
		run.ErrorCode = errorCode.String
		run.ErrorMessage = errorMessage.String
		runs = append(runs, run)
	}
	return runs, nil
}

// CountByStatus retorna contagem de runs agrupada por status.
// Usado pelo endpoint de sumário operacional.
func (r *RunRepo) CountByStatus(ctx context.Context) (map[string]int, error) {
	const q = `SELECT status, COUNT(*) FROM bot_runs GROUP BY status`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		counts[status] = count
	}
	return counts, nil
}
