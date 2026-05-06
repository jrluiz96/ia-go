# Template - Geracao de Bot Python (IA)

Use este template para montar a chamada da IA na tela de criacao de automacao.

## Instrucoes para a IA

Voce vai gerar um bot Python para automacao web, orquestrado por Go.
Siga obrigatoriamente o padrao do repositorio em .github/copilot-instructions.md.

Escopo: a IA participa apenas da criacao/manutencao do codigo. A execucao em producao ocorre sem IA no loop.

Se faltar qualquer informacao essencial, NAO gere o codigo ainda.
Primeiro retorne somente um bloco "PERGUNTAS_PENDENTES" com os itens faltantes.

Stack padrao obrigatoria:
- playwright
- pydantic
- tenacity
- httpx
- structlog ou logging JSON
- pytest (+ pytest-asyncio quando necessario)

Restricoes obrigatorias:
- Nao usar selenium, exceto se houver justificativa tecnica explicita.
- Nao incluir segredos em texto puro no codigo.
- Usar credential_ref/secret_id para autenticacao.
- Gerar entrada e saida compativeis com contract_version 1.0.

## Dados de entrada da solicitacao

```yaml
request_id: "{{request_id}}"
bot_name: "{{bot_name}}"
bot_description_nl: "{{bot_description_nl}}"
run_type: "{{run_type}}" # ad_hoc_test | scheduled

alvo:
  base_url: "{{base_url}}"
  ambiente: "{{ambiente}}" # homolog | prod

autenticacao:
  type: "{{auth_type}}" # basic_login | bearer_token | client_cert_file | windows_cert_store
  credential_ref:
    provider: "{{credential_provider}}" # vault | aws_secrets_manager | etc
    secret_id: "{{secret_id}}"

coleta:
  objetivo: "{{objetivo_coleta}}"
  campos_saida:
    - "{{campo_1}}"
    - "{{campo_2}}"
  formato_saida: "{{formato_saida}}" # json | csv
  filtros: "{{filtros}}"
  paginacao: "{{paginacao}}"

execucao:
  target: "{{target}}" # linux_headless | windows_host | windows_gui
  timeout_sec: {{timeout_sec}}
  max_retries: {{max_retries}}
  timezone: "{{timezone}}"

observabilidade:
  screenshot_on_error: {{screenshot_on_error}}
  save_html_on_error: {{save_html_on_error}}
  log_level: "{{log_level}}"

sucesso_erro:
  criterio_sucesso: "{{criterio_sucesso}}"
  erros_esperados:
    - "{{erro_1}}"
    - "{{erro_2}}"
```

## Campos essenciais que exigem pergunta se faltarem

1. base_url
2. auth_type
3. secret_id (ou confirmacao de criacao de nova credencial)
4. objetivo_coleta e campos_saida
5. target de execucao
6. timeout_sec e max_retries
7. criterio_sucesso

## Formato de resposta exigido da IA

Se faltar contexto:

```text
PERGUNTAS_PENDENTES:
1. ...
2. ...
```

Se o contexto estiver completo, retornar nesta ordem:

```text
RESUMO_DA_SOLUCAO
DEPENDENCIAS
ARQUIVOS_GERADOS
CODIGO
TESTES
COMO_EXECUTAR
PAYLOAD_EXEMPLO_CONTRATO_V1
```

## Regras de codigo gerado

1. Entregar ao menos estes arquivos:
- main.py
- contract.py
- runner.py
- auth.py
- tests/test_contract.py
- tests/test_runner_happy_path.py

2. O codigo deve:
- validar contrato com Pydantic;
- propagar run_id e trace_id nos logs;
- mapear erros para success | retryable_error | fatal_error;
- nunca expor segredo no output.

3. Entregar exemplo de output JSON padronizado:
- contract_version
- run_id
- status
- timestamps
- metrics
- result ou error
- artifacts (opcional)

## Prompt final (copiar e substituir placeholders)

Com base nos dados YAML acima, gere o bot Python completo conforme regras do repositorio.
Se faltar algum campo essencial, responda APENAS com PERGUNTAS_PENDENTES.
Se estiver completo, entregue os arquivos e testes no formato exigido.
