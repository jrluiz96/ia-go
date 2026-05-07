package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"ia-go/backend/internal/domain"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Stub
// ---------------------------------------------------------------------------

type updateCall struct {
	runID  string
	status domain.RunStatus
	output *domain.WorkerOutputV1
}

type stubWatchdogStore struct {
	stuckRuns []*domain.BotRun
	stuckErr  error
	updates   []updateCall
	updateErr error
	events    []*domain.RunEvent
}

func (s *stubWatchdogStore) GetStuckRuns(_ context.Context, _ time.Duration) ([]*domain.BotRun, error) {
	return s.stuckRuns, s.stuckErr
}

func (s *stubWatchdogStore) UpdateStatus(_ context.Context, runID string, status domain.RunStatus, output *domain.WorkerOutputV1) error {
	if s.updateErr != nil {
		return s.updateErr
	}
	s.updates = append(s.updates, updateCall{runID: runID, status: status, output: output})
	return nil
}

func (s *stubWatchdogStore) AppendEvent(_ context.Context, e *domain.RunEvent) error {
	s.events = append(s.events, e)
	return nil
}

func newTestWatchdog(store WatchdogStore) *Watchdog {
	return &Watchdog{
		runRepo:          store,
		interval:         60 * time.Second,
		heartbeatTimeout: 5 * time.Minute,
	}
}

var botID1 = uuid.MustParse("00000000-0000-0000-0000-000000000001")
var botID2 = uuid.MustParse("00000000-0000-0000-0000-000000000002")

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

func TestWatchdogTick_SemRunsTravadas(t *testing.T) {
	store := &stubWatchdogStore{}
	wd := newTestWatchdog(store)

	if err := wd.tick(context.Background()); err != nil {
		t.Fatalf("tick não deve retornar erro: %v", err)
	}
	if len(store.updates) != 0 {
		t.Errorf("nenhuma run deve ser atualizada, got %d", len(store.updates))
	}
}

func TestWatchdogTick_EncerraRunTravada(t *testing.T) {
	stuck := &domain.BotRun{RunID: "run_stuck_001", BotID: botID1, Attempt: 1}
	store := &stubWatchdogStore{stuckRuns: []*domain.BotRun{stuck}}
	wd := newTestWatchdog(store)

	if err := wd.tick(context.Background()); err != nil {
		t.Fatalf("tick não deve retornar erro: %v", err)
	}

	if len(store.updates) != 1 {
		t.Fatalf("1 run deve ser encerrada; got %d", len(store.updates))
	}
	if store.updates[0].runID != "run_stuck_001" {
		t.Errorf("run encerrada deve ser run_stuck_001; got %s", store.updates[0].runID)
	}
	if store.updates[0].status != domain.RunStatusFatalError {
		t.Errorf("status deve ser fatal_error; got %s", store.updates[0].status)
	}
	if store.updates[0].output.ErrorCode != "ERR_HEARTBEAT_TIMEOUT" {
		t.Errorf("error_code deve ser ERR_HEARTBEAT_TIMEOUT; got %s", store.updates[0].output.ErrorCode)
	}
}

func TestWatchdogTick_EventoDeEncerramento(t *testing.T) {
	stuck := &domain.BotRun{RunID: "run_ev_001", BotID: botID1, Attempt: 1}
	store := &stubWatchdogStore{stuckRuns: []*domain.BotRun{stuck}}
	wd := newTestWatchdog(store)

	_ = wd.tick(context.Background())

	if len(store.events) != 1 {
		t.Fatalf("1 evento deve ser registrado; got %d", len(store.events))
	}
	ev := store.events[0]
	if ev.RunID != "run_ev_001" {
		t.Errorf("evento.RunID deve ser run_ev_001; got %s", ev.RunID)
	}
	if ev.Level != "error" {
		t.Errorf("evento.Level deve ser error; got %s", ev.Level)
	}
	if ev.DataJSON["error_code"] != "ERR_HEARTBEAT_TIMEOUT" {
		t.Errorf("evento.DataJSON[error_code] deve ser ERR_HEARTBEAT_TIMEOUT; got %v", ev.DataJSON["error_code"])
	}
}

func TestWatchdogTick_ErroAoBuscarStuck(t *testing.T) {
	store := &stubWatchdogStore{stuckErr: errors.New("db offline")}
	wd := newTestWatchdog(store)

	err := wd.tick(context.Background())
	if err == nil {
		t.Fatal("tick deve retornar erro quando GetStuckRuns falha")
	}
	if len(store.updates) != 0 {
		t.Errorf("nenhuma run deve ser atualizada em caso de erro; got %d", len(store.updates))
	}
}

func TestWatchdogTick_EncerraMultiplasRunsTravadas(t *testing.T) {
	stuck := []*domain.BotRun{
		{RunID: "run_s_001", BotID: botID1, Attempt: 1},
		{RunID: "run_s_002", BotID: botID2, Attempt: 2},
	}
	store := &stubWatchdogStore{stuckRuns: stuck}
	wd := newTestWatchdog(store)

	if err := wd.tick(context.Background()); err != nil {
		t.Fatalf("tick não deve retornar erro: %v", err)
	}
	if len(store.updates) != 2 {
		t.Errorf("2 runs devem ser encerradas; got %d", len(store.updates))
	}
	if len(store.events) != 2 {
		t.Errorf("2 eventos devem ser registrados; got %d", len(store.events))
	}
}

func TestWatchdogTerminate_ErroAoAtualizar_NaoPanica(t *testing.T) {
	stuck := &domain.BotRun{RunID: "run_err_001", BotID: botID1, Attempt: 1}
	store := &stubWatchdogStore{
		stuckRuns: []*domain.BotRun{stuck},
		updateErr: errors.New("update failed"),
	}
	wd := newTestWatchdog(store)

	// tick não deve retornar erro externo quando terminate falha internamente
	if err := wd.tick(context.Background()); err != nil {
		t.Fatalf("tick não deve retornar erro externo quando terminate falha: %v", err)
	}
	// update falhou, então nenhum update foi registrado no stub
	if len(store.updates) != 0 {
		t.Errorf("updates deve estar vazio quando UpdateStatus retorna erro; got %v", store.updates)
	}
}
