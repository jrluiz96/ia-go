package httpsrv

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"ia-go/backend/internal/domain"
	"ia-go/backend/internal/queue"
	"ia-go/backend/internal/repository/postgres"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type RunHandler struct {
	runRepo     *postgres.RunRepo
	botRepo     *postgres.BotRepo
	queueClient *queue.Client
}

func NewRunHandler(runRepo *postgres.RunRepo, botRepo *postgres.BotRepo, queueClient *queue.Client) *RunHandler {
	return &RunHandler{runRepo: runRepo, botRepo: botRepo, queueClient: queueClient}
}

func (h *RunHandler) AdHocTest(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	var input domain.AdHocTestInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}
	input.BotID = botID

	if input.TimeoutSec == 0 {
		input.TimeoutSec = 120
	}
	if input.TimeoutSec < 60 || input.TimeoutSec > 180 {
		jsonError(w, "timeout_sec deve estar entre 60 e 180", http.StatusUnprocessableEntity)
		return
	}
	if input.TraceID == "" {
		input.TraceID = uuid.New().String()
	}

	now := time.Now()
	runID := fmt.Sprintf("run_adhoc_%s_%d", botID.String()[:8], now.UnixMilli())

	run := &domain.BotRun{
		RunID:       runID,
		BotID:       botID,
		RunType:     domain.RunTypeAdHocTest,
		Status:      domain.RunStatusQueued,
		ScheduledAt: &now,
		TraceID:     input.TraceID,
		Attempt:     1,
		InputJSON: map[string]interface{}{
			"params":      input.Params,
			"timeout_sec": input.TimeoutSec,
		},
	}
	if input.BotVersionID != uuid.Nil {
		run.BotVersionID = &input.BotVersionID
	}

	created, err := h.runRepo.Create(r.Context(), run)
	if err != nil {
		jsonError(w, "erro ao criar execução: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Registra evento inicial
	_ = h.runRepo.AppendEvent(r.Context(), &domain.RunEvent{
		RunID:   runID,
		Level:   "info",
		Message: "ad_hoc_test enfileirado",
		DataJSON: map[string]interface{}{
			"trace_id":    input.TraceID,
			"timeout_sec": input.TimeoutSec,
		},
	})

	// Publica na fila Redis Streams
	if h.queueClient != nil {
		versionIDStr := ""
		if input.BotVersionID != uuid.Nil {
			versionIDStr = input.BotVersionID.String()
		}
		if _, err := h.queueClient.Publish(r.Context(), queue.StreamAdHoc, queue.JobPayload{
			RunID:      runID,
			BotID:      botID.String(),
			VersionID:  versionIDStr,
			RunType:    string(domain.RunTypeAdHocTest),
			Params:     input.Params,
			TraceID:    input.TraceID,
			TimeoutSec: input.TimeoutSec,
		}); err != nil {
			// Falha ao enfileirar: atualiza status para fatal_error e retorna 503
			_ = h.runRepo.UpdateStatus(r.Context(), runID, domain.RunStatusFatalError, &domain.WorkerOutputV1{
				RunID:        runID,
				Status:       domain.RunStatusFatalError,
				ErrorCode:    "ERR_QUEUE_PUBLISH",
				ErrorMessage: "falha ao publicar job na fila: " + err.Error(),
			})
			jsonError(w, "falha ao enfileirar execução: "+err.Error(), http.StatusServiceUnavailable)
			return
		}
	}

	jsonResponse(w, created, http.StatusAccepted)
}

func (h *RunHandler) Get(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		jsonError(w, "runID inválido", http.StatusBadRequest)
		return
	}

	run, err := h.runRepo.GetByRunID(r.Context(), runID)
	if err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			jsonError(w, "execução não encontrada", http.StatusNotFound)
		} else {
			jsonError(w, "erro ao buscar execução: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	jsonResponse(w, run, http.StatusOK)
}

func (h *RunHandler) ListByBot(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	runs, err := h.runRepo.ListByBotID(r.Context(), botID, limit)
	if err != nil {
		jsonError(w, "erro ao listar execuções: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if runs == nil {
		runs = []*domain.BotRun{}
	}
	jsonResponse(w, runs, http.StatusOK)
}

func (h *RunHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		jsonError(w, "runID inválido", http.StatusBadRequest)
		return
	}

	events, err := h.runRepo.ListEvents(r.Context(), runID)
	if err != nil {
		jsonError(w, "erro ao listar eventos: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if events == nil {
		events = []*domain.RunEvent{}
	}
	jsonResponse(w, events, http.StatusOK)
}

// ReportStatus é chamado pelo worker Python ao concluir uma execução.
// POST /api/v1/runs/{runID}/status
func (h *RunHandler) ReportStatus(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		jsonError(w, "runID inválido", http.StatusBadRequest)
		return
	}

	var output domain.WorkerOutputV1
	if err := json.NewDecoder(r.Body).Decode(&output); err != nil {
		jsonError(w, "payload inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Valida status recebido
	validStatuses := map[domain.RunStatus]bool{
		domain.RunStatusRunning:        true,
		domain.RunStatusSuccess:        true,
		domain.RunStatusRetryableError: true,
		domain.RunStatusFatalError:     true,
		domain.RunStatusCanceled:       true,
	}
	if !validStatuses[output.Status] {
		jsonError(w, "status inválido: "+string(output.Status), http.StatusUnprocessableEntity)
		return
	}

	if err := h.runRepo.UpdateStatus(r.Context(), runID, output.Status, &output); err != nil {
		jsonError(w, "erro ao atualizar status: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Registra evento de conclusão
	level := "info"
	if output.Status == domain.RunStatusFatalError || output.Status == domain.RunStatusRetryableError {
		level = "error"
	}
	_ = h.runRepo.AppendEvent(r.Context(), &domain.RunEvent{
		RunID:   runID,
		Level:   level,
		Message: "status atualizado pelo worker: " + string(output.Status),
		DataJSON: map[string]interface{}{
			"error_code":    output.ErrorCode,
			"error_message": output.ErrorMessage,
			"duration_ms":   output.Metrics.DurationMs,
			"steps":         output.Metrics.Steps,
		},
	})

	jsonResponse(w, map[string]string{"status": "ok"}, http.StatusOK)
}

// Heartbeat é chamado pelo worker durante execução para sinalizar que está vivo.
// POST /api/v1/runs/{runID}/heartbeat
func (h *RunHandler) Heartbeat(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		jsonError(w, "runID inválido", http.StatusBadRequest)
		return
	}

	if err := h.runRepo.UpdateHeartbeat(r.Context(), runID); err != nil {
		jsonError(w, "erro ao atualizar heartbeat: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]string{"status": "ok"}, http.StatusOK)
}

// OpsSummary retorna sumário operacional: contagem por status, runs travadas.
// GET /api/v1/ops/summary
func (h *RunHandler) OpsSummary(w http.ResponseWriter, r *http.Request) {
	counts, err := h.runRepo.CountByStatus(r.Context())
	if err != nil {
		jsonError(w, "erro ao buscar sumário: "+err.Error(), http.StatusInternalServerError)
		return
	}

	stuck, err := h.runRepo.GetStuckRuns(r.Context(), 5*time.Minute)
	if err != nil {
		jsonError(w, "erro ao buscar runs travadas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	stuckIDs := make([]string, 0, len(stuck))
	for _, r := range stuck {
		stuckIDs = append(stuckIDs, r.RunID)
	}

	jsonResponse(w, map[string]interface{}{
		"status_counts": counts,
		"stuck_runs":    stuckIDs,
		"stuck_count":   len(stuckIDs),
	}, http.StatusOK)
}
