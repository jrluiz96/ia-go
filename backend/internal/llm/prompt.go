package llm

import (
	"fmt"
	"strings"
)

// GenerationRequest contém os dados preenchidos pelo usuário para gerar um bot.
type GenerationRequest struct {
	RequestID        string
	BotName          string
	BotDescriptionNL string
	RunType          string

	BaseURL  string
	Ambiente string

	AuthType           string
	CredentialProvider string
	SecretID           string

	ObjetivoColeta string
	CamposSaida    []string
	FormatoSaida   string
	Filtros        string
	Paginacao      string

	Target     string
	TimeoutSec int
	MaxRetries int
	Timezone   string

	ScreenshotOnError bool
	SaveHTMLOnError   bool
	LogLevel          string

	CriterioSucesso string
	ErrosEsperados  []string
}

// GenerationResponse é o retorno do serviço LLM.
type GenerationResponse struct {
	// PendingQuestions lista os campos faltantes (não nil = precisa de mais info).
	PendingQuestions []string
	// RawContent é a resposta completa da IA quando o contexto está completo.
	RawContent string
	// ParsedFiles mapeia nome do arquivo -> conteúdo extraído.
	ParsedFiles map[string]string
}

const systemPromptGeneration = `Você é um gerador de bots Python para automação web, orquestrado por Go.
Siga obrigatoriamente o padrão do repositório: use playwright, pydantic, tenacity, httpx, structlog.
Nunca inclua segredos em texto puro. Use credential_ref/secret_id.
Gere entrada e saída compatíveis com contract_version 1.0.
Se faltar informação essencial, retorne SOMENTE um bloco PERGUNTAS_PENDENTES.`

// BuildGenerationPrompt monta o prompt de usuário com os dados do formulário.
func BuildGenerationPrompt(req GenerationRequest) string {
	campos := strings.Join(req.CamposSaida, "\n    - ")
	erros := strings.Join(req.ErrosEsperados, "\n    - ")

	return fmt.Sprintf(`request_id: "%s"
bot_name: "%s"
bot_description_nl: "%s"
run_type: "%s"

alvo:
  base_url: "%s"
  ambiente: "%s"

autenticacao:
  type: "%s"
  credential_ref:
    provider: "%s"
    secret_id: "%s"

coleta:
  objetivo: "%s"
  campos_saida:
    - %s
  formato_saida: "%s"
  filtros: "%s"
  paginacao: "%s"

execucao:
  target: "%s"
  timeout_sec: %d
  max_retries: %d
  timezone: "%s"

observabilidade:
  screenshot_on_error: %v
  save_html_on_error: %v
  log_level: "%s"

sucesso_erro:
  criterio_sucesso: "%s"
  erros_esperados:
    - %s`,
		req.RequestID, req.BotName, req.BotDescriptionNL, req.RunType,
		req.BaseURL, req.Ambiente,
		req.AuthType, req.CredentialProvider, req.SecretID,
		req.ObjetivoColeta, campos, req.FormatoSaida, req.Filtros, req.Paginacao,
		req.Target, req.TimeoutSec, req.MaxRetries, req.Timezone,
		req.ScreenshotOnError, req.SaveHTMLOnError, req.LogLevel,
		req.CriterioSucesso, erros,
	)
}

// ParseResponse analisa a resposta da IA e detecta perguntas pendentes ou código gerado.
func ParseResponse(raw string) GenerationResponse {
	if strings.Contains(raw, "PERGUNTAS_PENDENTES") {
		questions := extractPendingQuestions(raw)
		return GenerationResponse{PendingQuestions: questions}
	}

	return GenerationResponse{
		RawContent:  raw,
		ParsedFiles: extractCodeBlocks(raw),
	}
}

func extractPendingQuestions(raw string) []string {
	var questions []string
	lines := strings.Split(raw, "\n")
	inBlock := false
	for _, line := range lines {
		if strings.Contains(line, "PERGUNTAS_PENDENTES") {
			inBlock = true
			continue
		}
		if inBlock {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" {
				continue
			}
			// Para quando encontrar outro bloco de seção
			if strings.HasPrefix(trimmed, "#") || strings.HasPrefix(trimmed, "```") {
				break
			}
			// Remove numeração "1. ", "2. ", etc.
			if len(trimmed) > 2 && trimmed[1] == '.' {
				trimmed = strings.TrimSpace(trimmed[2:])
			}
			if trimmed != "" {
				questions = append(questions, trimmed)
			}
		}
	}
	return questions
}

func extractCodeBlocks(raw string) map[string]string {
	files := make(map[string]string)
	lines := strings.Split(raw, "\n")
	var currentFile string
	var buf strings.Builder
	inCode := false

	for _, line := range lines {
		// Detecta marcador de arquivo: ```python # main.py ou ### main.py
		if strings.HasPrefix(line, "```") && !inCode {
			// Extrai nome do arquivo se houver comentário na mesma linha
			rest := strings.TrimPrefix(line, "```")
			rest = strings.TrimSpace(strings.TrimPrefix(rest, "python"))
			rest = strings.TrimSpace(strings.TrimPrefix(rest, "# "))
			if rest != "" {
				currentFile = rest
			} else if currentFile == "" {
				currentFile = "main.py"
			}
			inCode = true
			buf.Reset()
			continue
		}
		if strings.HasPrefix(line, "```") && inCode {
			if currentFile != "" {
				files[currentFile] = buf.String()
			}
			inCode = false
			currentFile = ""
			continue
		}
		if strings.HasPrefix(line, "### ") && strings.HasSuffix(line, ".py") {
			currentFile = strings.TrimPrefix(line, "### ")
			continue
		}
		if inCode {
			buf.WriteString(line + "\n")
		}
	}
	return files
}

// SystemPromptForGeneration retorna o system prompt de geração.
func SystemPromptForGeneration() string {
	return systemPromptGeneration
}
