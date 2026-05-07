package httpsrv

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ia-go/backend/internal/domain"
	"ia-go/backend/internal/repository/postgres"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Stub do repositório
// ---------------------------------------------------------------------------

type stubRunRepo struct {
	heartbeatErr error
	counts       map[string]int
	countsErr    error
	stuckRuns    []*domain.BotRun
	stuckErr     error
	updateErr    error
	updates      []string
}

func (s *stubRunRepo) Create(_ context.Context, run *domain.BotRun) (*domain.BotRun, error) {
	return run, nil
}
func (s *stubRunRepo) GetByRunID(_ context.Context, _ string) (*domain.BotRun, error) {
	return nil, postgres.ErrNotFound
}
func (s *stubRunRepo) ListByBotID(_ context.Context, _ uuid.UUID, _ int) ([]*domain.BotRun, error) {
	return nil, nil
}
func (s *stubRunRepo) ListEvents(_ context.Context, _ string) ([]*domain.RunEvent, error) {
	return nil, nil
}
func (s *stubRunRepo) UpdateStatus(_ context.Context, runID string, _ domain.RunStatus, _ *domain.WorkerOutputV1) error {
	if s.updateErr != nil {
		return s.updateErr
	}
	s.updates = append(s.updates, runID)
	return nil
}
func (s *stubRunRepo) AppendEvent(_ context.Context, _ *domain.RunEvent) error { return nil }
func (s *stubRunRepo) UpdateHeartbeat(_ context.Context, _ string) error       { return s.heartbeatErr }
func (s *stubRunRepo) CountByStatus(_ context.Context) (map[string]int, error) {
	return s.counts, s.countsErr
}
func (s *stubRunRepo) GetStuckRuns(_ context.Context, _ time.Duration) ([]*domain.BotRun, error) {
	return s.stuckRuns, s.stuckErr
}

// ---------------------------------------------------------------------------
// Router de teste (apenas rotas da sprint 4)
// ---------------------------------------------------------------------------

func newTestRunRouter(repo runRepoI) http.Handler {
	h := &RunHandler{runRepo: repo}
	r := chi.NewRouter()
	r.Post("/runs/{runID}/status", h.ReportStatus)
	r.Post("/runs/{runID}/heartbeat", h.Heartbeat)
	r.Get("/ops/summary", h.OpsSummary)
	return r
}

// ---------------------------------------------------------------------------
// ReportStatus — validação de status
// ---------------------------------------------------------------------------

func TestReportStatus_StatusValidos(t *testing.T) {
	cases := []struct {
		status domain.RunStatus
	}{
		{domain.RunStatusRunning},
		{domain.RunStatusSuccess},
		{domain.RunStatusFatalError},
		{domain.RunStatusCanceled},
	}

	for _, tc := range cases {
		t.Run(string(tc.status), func(t *testing.T) {
			store := &stubRunRepo{}
			router := newTestRunRouter(store)

			body, _ := json.Marshal(domain.WorkerOutputV1{
				RunID:  "run_test_001",
				Status: tc.status,
			})
			req := httptest.NewRequest(http.MethodPost, "/runs/run_test_001/status", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("status=%s deveria retornar 200, got %d (body=%s)", tc.status, w.Code, w.Body.String())
			}
		})
	}
}

func TestReportStatus_RetryableErrorRejeitado(t *testing.T) {
	store := &stubRunRepo{}
	router := newTestRunRouter(store)

	body, _ := json.Marshal(domain.WorkerOutputV1{
		RunID:  "run_test_002",
		Status: domain.RunStatusRetryableError,
	})
	req := httptest.NewRequest(http.MethodPost, "/runs/run_test_002/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("retryable_error deve retornar 422, got %d", w.Code)
	}
	// Repositório não deve ser chamado
	if len(store.updates) != 0 {
		t.Errorf("UpdateStatus não deve ser chamado para status inválido; got %v", store.updates)
	}
}

func TestReportStatus_StatusDesconhecidoRejeitado(t *testing.T) {
	store := &stubRunRepo{}
	router := newTestRunRouter(store)

	body := []byte(`{"run_id":"run_003","status":"unknown_status"}`)
	req := httptest.NewRequest(http.MethodPost, "/runs/run_003/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("status desconhecido deve retornar 422, got %d", w.Code)
	}
}

func TestReportStatus_PayloadInvalido(t *testing.T) {
	store := &stubRunRepo{}
	router := newTestRunRouter(store)

	req := httptest.NewRequest(http.MethodPost, "/runs/run_004/status", bytes.NewReader([]byte(`{invalid}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("payload inválido deve retornar 400, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

func TestHeartbeat_RetornaOK(t *testing.T) {
	store := &stubRunRepo{}
	router := newTestRunRouter(store)

	req := httptest.NewRequest(http.MethodPost, "/runs/run_hb_001/heartbeat", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("heartbeat deve retornar 200, got %d", w.Code)
	}
}

func TestHeartbeat_RunIDVazio(t *testing.T) {
	// chi não roteará para o handler sem runID — o router responderá 405 ou 404
	// Aqui validamos apenas que o handler trata runID vazio com 400
	h := &RunHandler{runRepo: &stubRunRepo{}}
	req := httptest.NewRequest(http.MethodPost, "/runs//heartbeat", nil)

	// Simula chi sem parâmetro (runID = "")
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("runID", "")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	h.Heartbeat(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("runID vazio deve retornar 400, got %d", w.Code)
	}
}

func TestHeartbeat_ErroNoRepositorio(t *testing.T) {
	store := &stubRunRepo{heartbeatErr: errors.New("db error")}
	router := newTestRunRouter(store)

	req := httptest.NewRequest(http.MethodPost, "/runs/run_hb_002/heartbeat", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("erro de repositório deve retornar 500, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// OpsSummary
// ---------------------------------------------------------------------------

func TestOpsSummary_RetornaContagens(t *testing.T) {
	store := &stubRunRepo{
		counts: map[string]int{
			"success":     10,
			"fatal_error": 2,
			"queued":      3,
		},
	}
	router := newTestRunRouter(store)

	req := httptest.NewRequest(http.MethodGet, "/ops/summary", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("ops/summary deve retornar 200, got %d (body=%s)", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("resposta deve ser JSON válido: %v", err)
	}

	counts, ok := resp["status_counts"].(map[string]interface{})
	if !ok {
		t.Fatal("resposta deve conter status_counts")
	}
	if int(counts["success"].(float64)) != 10 {
		t.Errorf("status_counts.success deve ser 10; got %v", counts["success"])
	}

	if _, ok := resp["stuck_runs"]; !ok {
		t.Error("resposta deve conter stuck_runs")
	}
	if _, ok := resp["stuck_count"]; !ok {
		t.Error("resposta deve conter stuck_count")
	}
}

func TestOpsSummary_SemRunsTravadas(t *testing.T) {
	store := &stubRunRepo{
		counts:    map[string]int{"success": 5},
		stuckRuns: nil,
	}
	router := newTestRunRouter(store)

	req := httptest.NewRequest(http.MethodGet, "/ops/summary", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("ops/summary deve retornar 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["stuck_count"].(float64) != 0 {
		t.Errorf("stuck_count deve ser 0; got %v", resp["stuck_count"])
	}
}

func TestOpsSummary_ComRunsTravadas(t *testing.T) {
	stuck := []*domain.BotRun{
		{RunID: "run_stuck_001", BotID: uuid.MustParse("00000000-0000-0000-0000-000000000001")},
		{RunID: "run_stuck_002", BotID: uuid.MustParse("00000000-0000-0000-0000-000000000002")},
	}
	store := &stubRunRepo{counts: map[string]int{"running": 2}, stuckRuns: stuck}
	router := newTestRunRouter(store)

	req := httptest.NewRequest(http.MethodGet, "/ops/summary", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("ops/summary deve retornar 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["stuck_count"].(float64) != 2 {
		t.Errorf("stuck_count deve ser 2; got %v", resp["stuck_count"])
	}

	ids, ok := resp["stuck_runs"].([]interface{})
	if !ok || len(ids) != 2 {
		t.Errorf("stuck_runs deve conter 2 IDs; got %v", resp["stuck_runs"])
	}
}

func TestOpsSummary_ErroAoContarStatus(t *testing.T) {
	store := &stubRunRepo{countsErr: errors.New("db error")}
	router := newTestRunRouter(store)

	req := httptest.NewRequest(http.MethodGet, "/ops/summary", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("erro de repositório deve retornar 500, got %d", w.Code)
	}
}
