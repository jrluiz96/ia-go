package service

import (
	"context"
	"log"
	"time"

	"ia-go/backend/internal/domain"
	"ia-go/backend/internal/repository/postgres"
)

// Watchdog monitora runs travadas (status=running sem heartbeat recente)
// e as encerra com fatal_error.
type Watchdog struct {
	runRepo          *postgres.RunRepo
	interval         time.Duration
	heartbeatTimeout time.Duration
}

func NewWatchdog(runRepo *postgres.RunRepo) *Watchdog {
	return &Watchdog{
		runRepo:          runRepo,
		interval:         60 * time.Second,
		heartbeatTimeout: 5 * time.Minute,
	}
}

// Start inicia o loop do watchdog. Bloqueia até ctx ser cancelado.
func (w *Watchdog) Start(ctx context.Context) {
	log.Printf("watchdog: iniciado (intervalo=%s, timeout_heartbeat=%s)",
		w.interval, w.heartbeatTimeout)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("watchdog: encerrado")
			return
		case <-ticker.C:
			if err := w.tick(ctx); err != nil {
				log.Printf("watchdog: erro no tick: %v", err)
			}
		}
	}
}

func (w *Watchdog) tick(ctx context.Context) error {
	stuck, err := w.runRepo.GetStuckRuns(ctx, w.heartbeatTimeout)
	if err != nil {
		return err
	}

	for _, run := range stuck {
		w.terminate(ctx, run)
	}
	return nil
}

func (w *Watchdog) terminate(ctx context.Context, run *domain.BotRun) {
	log.Printf("watchdog: run travada detectada run_id=%s bot_id=%s attempt=%d",
		run.RunID, run.BotID, run.Attempt)

	if err := w.runRepo.UpdateStatus(ctx, run.RunID, domain.RunStatusFatalError, &domain.WorkerOutputV1{
		RunID:        run.RunID,
		Status:       domain.RunStatusFatalError,
		ErrorCode:    "ERR_HEARTBEAT_TIMEOUT",
		ErrorMessage: "execução encerrada por watchdog: sem heartbeat por mais de 5 minutos",
	}); err != nil {
		log.Printf("watchdog: falha ao encerrar run_id=%s: %v", run.RunID, err)
		return
	}

	_ = w.runRepo.AppendEvent(ctx, &domain.RunEvent{
		RunID:   run.RunID,
		Level:   "error",
		Message: "watchdog: run encerrada por timeout de heartbeat",
		DataJSON: map[string]interface{}{
			"error_code": "ERR_HEARTBEAT_TIMEOUT",
			"threshold":  w.heartbeatTimeout.String(),
		},
	})
}
