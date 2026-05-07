package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"ia-go/backend/internal/domain"
	"ia-go/backend/internal/queue"
	"ia-go/backend/internal/repository/postgres"

	"github.com/google/uuid"
)

// Scheduler consulta agendamentos vencidos e despacha jobs para a fila.
type Scheduler struct {
	botRepo     *postgres.BotRepo
	runRepo     *postgres.RunRepo
	schedRepo   *postgres.ScheduleRepo
	queueClient *queue.Client
	interval    time.Duration
}

func NewScheduler(
	botRepo *postgres.BotRepo,
	runRepo *postgres.RunRepo,
	schedRepo *postgres.ScheduleRepo,
	queueClient *queue.Client,
) *Scheduler {
	return &Scheduler{
		botRepo:     botRepo,
		runRepo:     runRepo,
		schedRepo:   schedRepo,
		queueClient: queueClient,
		interval:    30 * time.Second,
	}
}

// Start inicia o loop do scheduler. Bloqueia até ctx ser cancelado.
func (s *Scheduler) Start(ctx context.Context) {
	log.Println("scheduler: iniciado (intervalo=30s)")
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("scheduler: encerrado")
			return
		case <-ticker.C:
			if err := s.tick(ctx); err != nil {
				log.Printf("scheduler: erro no tick: %v", err)
			}
		}
	}
}

func (s *Scheduler) tick(ctx context.Context) error {
	due, err := s.schedRepo.GetDue(ctx)
	if err != nil {
		return fmt.Errorf("buscar agendamentos vencidos: %w", err)
	}

	for _, sched := range due {
		if err := s.dispatch(ctx, sched); err != nil {
			log.Printf("scheduler: dispatch falhou schedule_id=%s bot_id=%s: %v",
				sched.ID, sched.BotID, err)
		}
	}
	return nil
}

func (s *Scheduler) dispatch(ctx context.Context, sched *domain.BotSchedule) error {
	// Apenas versão published executa no scheduler.
	// Distingue "sem versão published" (avança agenda, sem erro) de falha de infra (retorna erro).
	published, err := s.botRepo.GetPublishedVersion(ctx, sched.BotID)
	if err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			log.Printf("scheduler: bot %s sem versão published, avançando agenda", sched.BotID)
			return s.schedRepo.UpdateNextRun(ctx, sched.ID, sched.CronExpr, sched.Timezone)
		}
		return fmt.Errorf("buscar versão published bot_id=%s: %w", sched.BotID, err)
	}

	// run_id idempotente por schedule + janela de 1 minuto.
	now := time.Now().UTC()
	windowMin := now.Unix() / 60
	runID := fmt.Sprintf("run_sched_%s_%d", sched.ID.String()[:8], windowMin)

	// Idempotência: só avança agenda se o run já foi despachado com sucesso.
	// fatal_error indica falha de publish anterior — não avança para tentar novamente.
	existing, err := s.runRepo.GetByRunID(ctx, runID)
	if err != nil && !errors.Is(err, postgres.ErrNotFound) {
		return fmt.Errorf("verificar idempotência run_id=%s: %w", runID, err)
	}
	if existing != nil {
		if existing.Status == domain.RunStatusFatalError {
			return fmt.Errorf("run_id=%s em fatal_error, aguardando próxima janela de minuto", runID)
		}
		log.Printf("scheduler: run_id=%s já despachado (idempotência), avançando agenda", runID)
		return s.schedRepo.UpdateNextRun(ctx, sched.ID, sched.CronExpr, sched.Timezone)
	}

	traceID := uuid.New().String()

	// Serializa o contrato v1 da versão published para enviar na fila.
	// O worker usa esse contrato como fonte da verdade, evitando reconstrução com defaults.
	contract := mapsClone(published.ContractJSON)
	contract["bot_version"] = published.Version
	contractBytes, err := json.Marshal(contract)
	if err != nil {
		return fmt.Errorf("serializar contract_json bot_id=%s version=%d: %w",
			sched.BotID, published.Version, err)
	}

	run := &domain.BotRun{
		RunID:        runID,
		BotID:        sched.BotID,
		BotVersionID: &published.ID,
		RunType:      domain.RunTypeScheduled,
		Status:       domain.RunStatusQueued,
		ScheduledAt:  &now,
		TraceID:      traceID,
		Attempt:      1,
		InputJSON: map[string]interface{}{
			"schedule_id": sched.ID.String(),
			"cron_expr":   sched.CronExpr,
			"timezone":    sched.Timezone,
		},
	}

	if _, err := s.runRepo.Create(ctx, run); err != nil {
		return fmt.Errorf("criar BotRun: %w", err)
	}

	payload := queue.JobPayload{
		RunID:        runID,
		BotID:        sched.BotID.String(),
		VersionID:    published.ID.String(),
		RunType:      string(domain.RunTypeScheduled),
		TraceID:      traceID,
		TimeoutSec:   300,
		ContractJSON: contractBytes,
		Params: map[string]interface{}{
			"schedule_id": sched.ID.String(),
		},
	}

	if _, err := s.queueClient.Publish(ctx, queue.StreamScheduled, payload); err != nil {
		// Marca o run como fatal_error. NÃO avança next_run_at:
		// o próximo tick pode tentar novamente dentro da mesma janela de minuto.
		_ = s.runRepo.UpdateStatus(ctx, runID, domain.RunStatusFatalError, nil)
		return fmt.Errorf("publicar job no stream: %w", err)
	}

	log.Printf("scheduler: job despachado run_id=%s bot_id=%s version=%d",
		runID, sched.BotID, published.Version)

	// Avança next_run_at APENAS após publish bem-sucedido.
	return s.schedRepo.UpdateNextRun(ctx, sched.ID, sched.CronExpr, sched.Timezone)
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
