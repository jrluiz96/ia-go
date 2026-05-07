package httpsrv

import (
	"encoding/json"
	"net/http"
	"strings"

	"ia-go/backend/internal/service"
)

type GenerateHandler struct {
	botSvc *service.BotService
}

func NewGenerateHandler(botSvc *service.BotService) *GenerateHandler {
	return &GenerateHandler{botSvc: botSvc}
}

// Generate é o endpoint principal de criação por linguagem natural.
// POST /api/v1/generate
func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req service.GenerateBotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}

	if req.BotName == "" {
		jsonError(w, "bot_name é obrigatório", http.StatusUnprocessableEntity)
		return
	}
	if req.OwnerID == "" {
		jsonError(w, "owner_id é obrigatório", http.StatusUnprocessableEntity)
		return
	}

	// Validação local antes de chamar o LLM
	pending := service.ValidateGenerationContext(req)
	if len(pending) > 0 {
		jsonResponse(w, map[string]interface{}{
			"status":            "pending_questions",
			"pending_questions": pending,
		}, http.StatusOK)
		return
	}

	result, err := h.botSvc.GenerateBot(r.Context(), req)
	if err != nil {
		// LLM não configurado → 503 Service Unavailable
		if strings.Contains(err.Error(), "LLM não configurado") {
			jsonError(w, "serviço de geração indisponível: configure LLM_BASE_URL ou LLM_API_KEY", http.StatusServiceUnavailable)
			return
		}
		jsonError(w, "erro ao gerar bot: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// LLM retornou perguntas pendentes adicionais
	if len(result.PendingQuestions) > 0 {
		jsonResponse(w, map[string]interface{}{
			"status":            "pending_questions",
			"pending_questions": result.PendingQuestions,
		}, http.StatusOK)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"status":      "draft_created",
		"bot_version": result.BotVersion,
	}, http.StatusCreated)
}

// Preview retorna as perguntas pendentes sem chamar o LLM.
// POST /api/v1/generate/preview
func (h *GenerateHandler) Preview(w http.ResponseWriter, r *http.Request) {
	var req service.GenerateBotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}

	pending := service.ValidateGenerationContext(req)
	jsonResponse(w, map[string]interface{}{
		"pending_questions": pending,
		"ready":             len(pending) == 0,
	}, http.StatusOK)
}
