package httpsrv

import (
	"encoding/json"
	"net/http"

	"ia-go/backend/internal/domain"
	"ia-go/backend/internal/repository/postgres"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ScheduleHandler struct {
	schedRepo *postgres.ScheduleRepo
}

func NewScheduleHandler(schedRepo *postgres.ScheduleRepo) *ScheduleHandler {
	return &ScheduleHandler{schedRepo: schedRepo}
}

func (h *ScheduleHandler) Create(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	var input domain.CreateScheduleInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}
	input.BotID = botID

	if input.CronExpr == "" {
		jsonError(w, "cron_expr é obrigatório", http.StatusUnprocessableEntity)
		return
	}
	if input.Timezone == "" {
		input.Timezone = "UTC"
	}

	sched, err := h.schedRepo.Create(r.Context(), input)
	if err != nil {
		jsonError(w, "erro ao criar agendamento: "+err.Error(), http.StatusUnprocessableEntity)
		return
	}

	jsonResponse(w, sched, http.StatusCreated)
}

func (h *ScheduleHandler) List(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	schedules, err := h.schedRepo.List(r.Context(), botID)
	if err != nil {
		jsonError(w, "erro ao listar agendamentos: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if schedules == nil {
		schedules = []*domain.BotSchedule{}
	}
	jsonResponse(w, schedules, http.StatusOK)
}

func (h *ScheduleHandler) Toggle(w http.ResponseWriter, r *http.Request) {
	_, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	schedID, err := uuid.Parse(chi.URLParam(r, "scheduleID"))
	if err != nil {
		jsonError(w, "scheduleID inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}

	if err := h.schedRepo.Toggle(r.Context(), schedID, body.Enabled); err != nil {
		jsonError(w, "erro ao atualizar agendamento: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]bool{"enabled": body.Enabled}, http.StatusOK)
}
