package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"ia-go/backend/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

type ScheduleRepo struct {
	db *pgxpool.Pool
}

func NewScheduleRepo(db *pgxpool.Pool) *ScheduleRepo {
	return &ScheduleRepo{db: db}
}

func (r *ScheduleRepo) Create(ctx context.Context, input domain.CreateScheduleInput) (*domain.BotSchedule, error) {
	if _, err := cron.ParseStandard(input.CronExpr); err != nil {
		return nil, fmt.Errorf("cron_expr inválido: %w", err)
	}
	if input.Timezone == "" {
		input.Timezone = "UTC"
	}

	nextRun := calcNextRun(input.CronExpr, input.Timezone)

	const q = `
		INSERT INTO bot_schedules (bot_id, cron_expr, timezone, next_run_at, enabled)
		VALUES ($1, $2, $3, $4, true)
		RETURNING id, bot_id, cron_expr, timezone, next_run_at, enabled, created_at, updated_at`

	s := &domain.BotSchedule{}
	err := r.db.QueryRow(ctx, q, input.BotID, input.CronExpr, input.Timezone, nextRun).
		Scan(&s.ID, &s.BotID, &s.CronExpr, &s.Timezone, &s.NextRunAt, &s.Enabled, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func (r *ScheduleRepo) List(ctx context.Context, botID uuid.UUID) ([]*domain.BotSchedule, error) {
	const q = `
		SELECT id, bot_id, cron_expr, timezone, next_run_at, enabled, created_at, updated_at
		FROM bot_schedules WHERE bot_id = $1 ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q, botID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []*domain.BotSchedule
	for rows.Next() {
		s := &domain.BotSchedule{}
		if err := rows.Scan(&s.ID, &s.BotID, &s.CronExpr, &s.Timezone, &s.NextRunAt, &s.Enabled, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		schedules = append(schedules, s)
	}
	return schedules, nil
}

func (r *ScheduleRepo) GetDue(ctx context.Context) ([]*domain.BotSchedule, error) {
	const q = `
		SELECT id, bot_id, cron_expr, timezone, next_run_at, enabled, created_at, updated_at
		FROM bot_schedules
		WHERE enabled = true AND next_run_at IS NOT NULL AND next_run_at <= NOW()
		ORDER BY next_run_at ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []*domain.BotSchedule
	for rows.Next() {
		s := &domain.BotSchedule{}
		if err := rows.Scan(&s.ID, &s.BotID, &s.CronExpr, &s.Timezone, &s.NextRunAt, &s.Enabled, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		schedules = append(schedules, s)
	}
	return schedules, nil
}

func (r *ScheduleRepo) UpdateNextRun(ctx context.Context, schedID uuid.UUID, cronExpr, timezone string) error {
	nextRun := calcNextRun(cronExpr, timezone)
	const q = `UPDATE bot_schedules SET next_run_at = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, q, nextRun, schedID)
	return err
}

func (r *ScheduleRepo) Toggle(ctx context.Context, schedID uuid.UUID, enabled bool) error {
	const q = `UPDATE bot_schedules SET enabled = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, q, enabled, schedID)
	return err
}

// GetByID retorna um agendamento específico.
func (r *ScheduleRepo) GetByID(ctx context.Context, schedID uuid.UUID) (*domain.BotSchedule, error) {
	const q = `
		SELECT id, bot_id, cron_expr, timezone, next_run_at, enabled, created_at, updated_at
		FROM bot_schedules WHERE id = $1`

	s := &domain.BotSchedule{}
	err := r.db.QueryRow(ctx, q, schedID).
		Scan(&s.ID, &s.BotID, &s.CronExpr, &s.Timezone, &s.NextRunAt, &s.Enabled, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s, nil
}

// calcNextRun calcula o próximo horário de execução com base na expressão cron e timezone.
func calcNextRun(cronExpr, timezone string) *time.Time {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(cronExpr)
	if err != nil {
		return nil
	}

	next := schedule.Next(time.Now().In(loc))
	return &next
}
