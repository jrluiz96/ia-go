package httpsrv

import (
	"encoding/json"
	"net/http"

	"ia-go/backend/internal/domain"
	"ia-go/backend/internal/repository/postgres"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type BotHandler struct {
	botRepo *postgres.BotRepo
}

func NewBotHandler(botRepo *postgres.BotRepo) *BotHandler {
	return &BotHandler{botRepo: botRepo}
}

func (h *BotHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateBotInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}

	if input.Name == "" {
		jsonError(w, "name é obrigatório", http.StatusUnprocessableEntity)
		return
	}
	if input.OwnerID == "" {
		jsonError(w, "owner_id é obrigatório", http.StatusUnprocessableEntity)
		return
	}

	bot, err := h.botRepo.Create(r.Context(), input)
	if err != nil {
		jsonError(w, "erro ao criar bot: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, bot, http.StatusCreated)
}

func (h *BotHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	bot, err := h.botRepo.GetByID(r.Context(), id)
	if err != nil {
		jsonError(w, "bot não encontrado", http.StatusNotFound)
		return
	}

	jsonResponse(w, bot, http.StatusOK)
}

func (h *BotHandler) List(w http.ResponseWriter, r *http.Request) {
	bots, err := h.botRepo.List(r.Context())
	if err != nil {
		jsonError(w, "erro ao listar bots: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if bots == nil {
		bots = []*domain.Bot{}
	}
	jsonResponse(w, bots, http.StatusOK)
}

func (h *BotHandler) CreateVersion(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	var input domain.CreateVersionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}
	input.BotID = botID

	if input.CodePython == "" {
		jsonError(w, "code_python é obrigatório", http.StatusUnprocessableEntity)
		return
	}
	if input.ContractJSON == nil {
		jsonError(w, "contract_json é obrigatório", http.StatusUnprocessableEntity)
		return
	}

	v, err := h.botRepo.CreateVersion(r.Context(), input)
	if err != nil {
		jsonError(w, "erro ao criar versão: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, v, http.StatusCreated)
}

func (h *BotHandler) ApproveVersion(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	versionID, err := uuid.Parse(chi.URLParam(r, "versionID"))
	if err != nil {
		jsonError(w, "versionID inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		ApprovedBy string `json:"approved_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}
	if body.ApprovedBy == "" {
		jsonError(w, "approved_by é obrigatório", http.StatusUnprocessableEntity)
		return
	}

	// Guard: só draft pode ser aprovado
	v, err := h.botRepo.GetVersion(r.Context(), botID, versionID)
	if err != nil {
		jsonError(w, "versão não encontrada", http.StatusNotFound)
		return
	}
	if v.Status != domain.BotStatusDraft {
		jsonError(w, "apenas versões em rascunho (draft) podem ser aprovadas", http.StatusConflict)
		return
	}

	if err := h.botRepo.UpdateVersionStatus(r.Context(), versionID, domain.BotStatusApproved, body.ApprovedBy); err != nil {
		jsonError(w, "erro ao aprovar versão: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]string{"status": "approved"}, http.StatusOK)
}

func (h *BotHandler) PublishVersion(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	versionID, err := uuid.Parse(chi.URLParam(r, "versionID"))
	if err != nil {
		jsonError(w, "versionID inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		PublishedBy string `json:"published_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "payload inválido", http.StatusBadRequest)
		return
	}
	if body.PublishedBy == "" {
		jsonError(w, "published_by é obrigatório", http.StatusUnprocessableEntity)
		return
	}

	// Guard: só versão approved pode ser publicada
	v, err := h.botRepo.GetVersion(r.Context(), botID, versionID)
	if err != nil {
		jsonError(w, "versão não encontrada", http.StatusNotFound)
		return
	}
	if v.Status != domain.BotStatusApproved {
		jsonError(w, "apenas versões aprovadas podem ser publicadas", http.StatusConflict)
		return
	}

	// Arquiva versão published atual (garante unique index)
	if err := h.botRepo.ArchiveCurrentPublished(r.Context(), botID); err != nil {
		jsonError(w, "erro ao arquivar versão anterior: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := h.botRepo.UpdateVersionStatus(r.Context(), versionID, domain.BotStatusPublished, body.PublishedBy); err != nil {
		jsonError(w, "erro ao publicar versão: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]string{"status": "published"}, http.StatusOK)
}

// ListVersions retorna todas as versões de um bot.
func (h *BotHandler) ListVersions(w http.ResponseWriter, r *http.Request) {
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		jsonError(w, "botID inválido", http.StatusBadRequest)
		return
	}

	versions, err := h.botRepo.ListVersionsByBot(r.Context(), botID)
	if err != nil {
		jsonError(w, "erro ao listar versões: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if versions == nil {
		versions = []*domain.BotVersion{}
	}
	jsonResponse(w, versions, http.StatusOK)
}

// --- helpers ---

func jsonResponse(w http.ResponseWriter, data interface{}, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	jsonResponse(w, map[string]string{"error": msg}, code)
}
