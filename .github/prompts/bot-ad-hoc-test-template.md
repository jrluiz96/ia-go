# Template - Teste Imediato de Bot Python (ad_hoc_test)

Use este template para o botao Testar da tela de criacao de automacao.

## Objetivo do modo ad_hoc_test

Executar uma validacao rapida do bot sem agendamento, com timeout curto e retorno de evidencias para a UI.

## Instrucoes para a IA

Voce vai gerar ou ajustar um bot Python para execucao de teste imediato.
Siga obrigatoriamente o padrao do repositorio em .github/copilot-instructions.md.

Escopo: a IA participa da geracao/manutencao de codigo. Em producao, os bots executam sem IA no runtime.

Se faltar qualquer informacao essencial, NAO gere o codigo.
Retorne apenas um bloco "PERGUNTAS_PENDENTES".

Stack padrao obrigatoria:
- playwright
- pydantic
- tenacity
- httpx
- structlog ou logging JSON
- pytest (+ pytest-asyncio quando necessario)

Restricoes obrigatorias:
- Nao usar selenium, exceto com justificativa tecnica explicita.
- Nao incluir segredos em texto puro no codigo.
- Usar credential_ref/secret_id para autenticacao.
- Respeitar contract_version 1.0.
- Em ad_hoc_test usar max_attempts=1.

## Dados de entrada da solicitacao

```yaml
request_id: "{{request_id}}"
mode: "ad_hoc_test"
bot_name: "{{bot_name}}"
bot_description_nl: "{{bot_description_nl}}"

alvo:
  base_url: "{{base_url}}"
  ambiente: "{{ambiente}}"

autenticacao:
  type: "{{auth_type}}"
  credential_ref:
    provider: "{{credential_provider}}"
    secret_id: "{{secret_id}}"

cenario_teste:
  objetivo: "{{objetivo_teste}}"
  passos_minimos:
    - "{{passo_1}}"
    - "{{passo_2}}"
  criterios_validacao:
    - "{{criterio_1}}"
    - "{{criterio_2}}"

execucao:
  target: "{{target}}" # linux_headless | windows_host | windows_gui
  timeout_sec: {{timeout_sec}} # recomendado: 60-180
  max_retries: 0
  timezone: "{{timezone}}"

observabilidade:
  screenshot_on_error: true
  save_html_on_error: true
  save_har: false
  log_level: "INFO"

saida_esperada:
  incluir_logs_resumidos: true
  incluir_artifacts: true
  formato_resultado: "json"
```

## Campos essenciais que exigem pergunta se faltarem

1. base_url
2. auth_type
3. secret_id (ou confirmacao de novo cadastro)
4. objetivo_teste
5. target
6. timeout_sec
7. ao menos 1 criterio_validacao

## Regras de execucao do teste imediato

1. run_type deve ser ad_hoc_test.
2. max_attempts deve ser 1 (sem retry automatico no teste).
3. timeout curto (padrao sugerido: 120s).
4. retorno focado em diagnostico rapido para UI.
5. nunca bloquear a resposta aguardando tarefas longas.

## Formato de resposta exigido da IA

Se faltar contexto:

```text
PERGUNTAS_PENDENTES:
1. ...
2. ...
```

Se estiver completo:

```text
RESUMO_TESTE
DEPENDENCIAS
ARQUIVOS_GERADOS
CODIGO
TESTES_MINIMOS
COMO_EXECUTAR_TESTE
PAYLOAD_AD_HOC_TEST
OUTPUT_EXEMPLO
```

## Entrega minima de arquivos

1. main.py
2. contract.py
3. runner.py
4. auth.py
5. tests/test_contract.py
6. tests/test_ad_hoc_test_flow.py

## Estrutura minima de output no ad_hoc_test

```json
{
  "contract_version": "1.0",
  "run_id": "run_test_001",
  "status": "success",
  "timestamps": {
    "started_at": "2026-05-05T10:00:01Z",
    "finished_at": "2026-05-05T10:01:12Z"
  },
  "metrics": {
    "duration_ms": 71000,
    "steps": 12,
    "retries_used": 0
  },
  "result": {
    "checks_passed": 3,
    "summary": "Login e navegacao principal validados"
  },
  "artifacts": {
    "screenshots": [
      "artifact://run_test_001/step-login.png"
    ],
    "html": [
      "artifact://run_test_001/final-page.html"
    ]
  }
}
```

## Prompt final (copiar e substituir placeholders)

Com base no YAML acima, gere o bot em modo ad_hoc_test.
Se faltar qualquer campo essencial, responda APENAS com PERGUNTAS_PENDENTES.
Se estiver completo, entregue codigo, testes minimos e payload de teste imediato.
