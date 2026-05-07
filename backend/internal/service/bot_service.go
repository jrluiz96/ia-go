package service

import (
	"context"
	"fmt"

	"ia-go/backend/internal/domain"
	"ia-go/backend/internal/llm"
	"ia-go/backend/internal/repository/postgres"

	"github.com/google/uuid"
)

// BotService orquestra a criação e manutenção de bots via IA.
type BotService struct {
	botRepo   *postgres.BotRepo
	llmClient llm.Client
}

func NewBotService(botRepo *postgres.BotRepo, llmClient llm.Client) *BotService {
	return &BotService{botRepo: botRepo, llmClient: llmClient}
}

// GenerateBotRequest é o payload de entrada da tela de criação.
type GenerateBotRequest struct {
	BotID              uuid.UUID `json:"bot_id"` // vazio = criar novo bot
	BotName            string    `json:"bot_name"`
	Description        string    `json:"description"`
	OwnerID            string    `json:"owner_id"`
	BaseURL            string    `json:"base_url"`
	Ambiente           string    `json:"ambiente"`
	AuthType           string    `json:"auth_type"`
	CredentialProvider string    `json:"credential_provider"`
	SecretID           string    `json:"secret_id"`
	ObjetivoColeta     string    `json:"objetivo_coleta"`
	CamposSaida        []string  `json:"campos_saida"`
	FormatoSaida       string    `json:"formato_saida"`
	Filtros            string    `json:"filtros"`
	Paginacao          string    `json:"paginacao"`
	Target             string    `json:"target"`
	TimeoutSec         int       `json:"timeout_sec"`
	MaxRetries         int       `json:"max_retries"`
	Timezone           string    `json:"timezone"`
	ScreenshotOnError  bool      `json:"screenshot_on_error"`
	SaveHTMLOnError    bool      `json:"save_html_on_error"`
	LogLevel           string    `json:"log_level"`
	CriterioSucesso    string    `json:"criterio_sucesso"`
	ErrosEsperados     []string  `json:"erros_esperados"`
}

// GenerateBotResult é o retorno da operação.
type GenerateBotResult struct {
	// Se PendingQuestions não for vazio, o código não foi gerado.
	PendingQuestions []string `json:"pending_questions,omitempty"`
	// BotVersion é a versão draft salva (nil se perguntas pendentes).
	BotVersion *domain.BotVersion `json:"bot_version,omitempty"`
	// RawLLMResponse é a resposta bruta da IA (para debug).
	RawLLMResponse string `json:"raw_llm_response,omitempty"`
}

// GenerateBot chama o LLM com o template e persiste o draft, se o contexto estiver completo.
func (s *BotService) GenerateBot(ctx context.Context, req GenerateBotRequest) (*GenerateBotResult, error) {
	if s.llmClient == nil {
		return nil, fmt.Errorf("serviço de geração indisponível: LLM não configurado")
	}
	// Garante defaults
	if req.TimeoutSec == 0 {
		req.TimeoutSec = 120
	}
	if req.LogLevel == "" {
		req.LogLevel = "INFO"
	}
	if req.FormatoSaida == "" {
		req.FormatoSaida = "json"
	}
	if req.Timezone == "" {
		req.Timezone = "America/Sao_Paulo"
	}

	// Monta prompt
	genReq := llm.GenerationRequest{
		RequestID:          uuid.New().String(),
		BotName:            req.BotName,
		BotDescriptionNL:   req.Description,
		RunType:            "scheduled",
		BaseURL:            req.BaseURL,
		Ambiente:           req.Ambiente,
		AuthType:           req.AuthType,
		CredentialProvider: req.CredentialProvider,
		SecretID:           req.SecretID,
		ObjetivoColeta:     req.ObjetivoColeta,
		CamposSaida:        req.CamposSaida,
		FormatoSaida:       req.FormatoSaida,
		Filtros:            req.Filtros,
		Paginacao:          req.Paginacao,
		Target:             req.Target,
		TimeoutSec:         req.TimeoutSec,
		MaxRetries:         req.MaxRetries,
		Timezone:           req.Timezone,
		ScreenshotOnError:  req.ScreenshotOnError,
		SaveHTMLOnError:    req.SaveHTMLOnError,
		LogLevel:           req.LogLevel,
		CriterioSucesso:    req.CriterioSucesso,
		ErrosEsperados:     req.ErrosEsperados,
	}

	userPrompt := llm.BuildGenerationPrompt(genReq)
	raw, err := s.llmClient.Complete(ctx, llm.SystemPromptForGeneration(), userPrompt)
	if err != nil {
		return nil, fmt.Errorf("service: gerar bot: %w", err)
	}

	parsed := llm.ParseResponse(raw)

	// Se há perguntas pendentes, retorna sem salvar
	if len(parsed.PendingQuestions) > 0 {
		return &GenerateBotResult{
			PendingQuestions: parsed.PendingQuestions,
			RawLLMResponse:   raw,
		}, nil
	}

	// Garante que o bot existe
	botID := req.BotID
	if botID == uuid.Nil {
		bot, err := s.botRepo.Create(ctx, domain.CreateBotInput{
			Name:        req.BotName,
			Description: req.Description,
			OwnerID:     req.OwnerID,
		})
		if err != nil {
			return nil, fmt.Errorf("service: criar bot: %w", err)
		}
		botID = bot.ID
	}

	// Extrai código principal (main.py) como código-fonte da versão
	codePython := parsed.RawContent
	if mainPy, ok := parsed.ParsedFiles["main.py"]; ok {
		codePython = mainPy
	}

	// Monta contrato base
	contractJSON := map[string]interface{}{
		"contract_version": "1.0",
		"execution_context": map[string]interface{}{
			"target":       req.Target,
			"timeout_sec":  req.TimeoutSec,
			"capabilities": []string{"web_headless"},
		},
		"retry_policy": map[string]interface{}{
			"max_attempts": req.MaxRetries,
			"backoff_sec":  30,
			"retry_on":     "retryable_error",
		},
		"params_schema": map[string]interface{}{
			"base_url": req.BaseURL,
			"ambiente": req.Ambiente,
		},
		"auth_profile": map[string]interface{}{
			"type": req.AuthType,
			"credential_ref": map[string]interface{}{
				"provider":  req.CredentialProvider,
				"secret_id": req.SecretID,
			},
		},
		"generated_files": parsed.ParsedFiles,
	}

	version, err := s.botRepo.CreateVersion(ctx, domain.CreateVersionInput{
		BotID:        botID,
		CodePython:   codePython,
		ContractJSON: contractJSON,
		CreatedBy:    req.OwnerID,
	})
	if err != nil {
		return nil, fmt.Errorf("service: salvar versão draft: %w", err)
	}

	return &GenerateBotResult{
		BotVersion:     version,
		RawLLMResponse: raw,
	}, nil
}

// ValidateGenerationContext verifica se os campos essenciais estão presentes
// sem chamar o LLM — retorna lista de perguntas pendentes locais.
func ValidateGenerationContext(req GenerateBotRequest) []string {
	var missing []string

	if req.BotName == "" {
		missing = append(missing, "Qual é o nome do bot?")
	}
	if req.BaseURL == "" {
		missing = append(missing, "Qual é a URL base do sistema alvo?")
	}
	if req.AuthType == "" {
		missing = append(missing, "Qual é o tipo de autenticação? (basic_login | bearer_token | client_cert_file | windows_cert_store | none)")
	}
	if req.SecretID == "" && req.AuthType != "none" && req.AuthType != "" {
		missing = append(missing, "Qual é o secret_id da credencial? (ou confirme que será criada uma nova)")
	}
	if req.ObjetivoColeta == "" {
		missing = append(missing, "Qual é o objetivo da coleta e quais campos devem ser extraídos?")
	}
	if req.Target == "" {
		missing = append(missing, "Qual é o target de execução? (linux_headless | windows_host | windows_gui)")
	}
	if req.TimeoutSec == 0 {
		missing = append(missing, "Qual é o timeout por execução em segundos? (recomendado: 60–300)")
	}
	if req.CriterioSucesso == "" {
		missing = append(missing, "Qual é o critério de sucesso da automação?")
	}

	return missing
}
