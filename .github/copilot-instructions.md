# IA-GO - Instrucoes do Copilot

## Objetivo
Gerar automacoes de navegador em Python para serem orquestradas por Go, seguindo contrato de execucao versionado e padrao de qualidade do projeto.

## Limite de escopo da IA
1. A IA atua apenas na criacao, manutencao e refatoracao de codigo Python dos bots.
2. Em producao, a execucao dos bots deve ser deterministica e sem componente de IA analisando run em tempo real.
3. Runtime de producao: scheduler/dispatcher/workers/fila/observabilidade operam sem decisao por LLM.
4. Qualquer uso de IA em runtime so pode ocorrer em modo diagnostico offline e com aprovacao explicita.

## Stack Python padrao (preferencial)
Use estas bibliotecas por padrao, salvo instrucao explicita em contrario:

1. playwright
2. pydantic
3. tenacity
4. httpx
5. structlog (ou logging padrao com JSON)
6. python-dateutil
7. orjson (quando serializacao for critica)
8. pytest
9. pytest-asyncio (quando houver async)
10. pytest-mock

## Bibliotecas permitidas com criterio
1. beautifulsoup4 e lxml: parsing HTML quando Playwright nao bastar.
2. pandas: somente para transformacao tabular relevante.
3. redis: lock/coordernacao simples de worker.

## Evitar por padrao
1. selenium (usar apenas se requisito tecnico exigir).
2. pyautogui para web automation (usar somente em casos de desktop GUI).
3. armazenar credenciais em codigo, env var exposta em logs ou arquivo de bot.

## Regras de implementacao dos bots
1. Todo bot deve aceitar entrada por JSON conforme contrato v1.
2. Todo bot deve retornar saida JSON padronizada (status, metrics, error/result).
3. Nao usar segredo em texto puro. Usar apenas credential_ref/secret_id.
4. Definir timeout por etapa critica (login, navegacao, download).
5. Implementar retry apenas para falhas transitorias.
6. Todo erro deve mapear para error.code estavel.
7. Todo bot deve gerar logs estruturados com trace_id e run_id.

## Estrutura minima recomendada para bot Python
1. main.py: entrypoint e parse do contrato.
2. contract.py: modelos Pydantic do contrato.
3. runner.py: fluxo principal de execucao.
4. auth.py: resolucao de credenciais e login.
5. steps/: etapas de negocio.
6. outputs.py: montagem de resultado e artifacts.
7. tests/: testes unitarios e de contrato.

## Padrao de codigo
1. Python 3.11+.
2. Type hints obrigatorios em funcoes publicas.
3. Funcoes curtas e separadas por responsabilidade.
4. Nomes explicitos para steps e seletores.
5. Comentarios somente quando o contexto nao for obvio.

## Padrao de testes
1. Criar testes para contrato de entrada e saida.
2. Criar testes para mapeamento de erro (retryable/fatal).
3. Criar testes de auth_profile (com mocks).
4. Criar ao menos 1 teste de fluxo feliz por bot.
5. Evitar dependencia de internet real em testes unitarios.

## Auto solicitacao de informacoes antes de gerar bot
Se qualquer item essencial estiver ausente, o agente deve perguntar antes de gerar codigo:

1. URL alvo e ambiente (homolog/prod).
2. Tipo de autenticacao (login/senha, token, certificado).
3. Origem da credencial (secret_id existente ou novo cadastro).
4. Campos/dados que devem ser coletados e formato de saida.
5. Regras de paginacao/filtro e volume estimado.
6. Elementos de UI criticos (seletores conhecidos ou paginas de referencia).
7. Janela de execucao, timeout e politica de retry.
8. Requisitos de evidencia (screenshot, html, log detalhado).
9. Restricoes de execucao (linux headless, windows cert store, GUI desktop).
10. Criterio de sucesso e condicoes de erro esperadas.

## Politica de entrega de codigo
1. Sempre incluir instrucoes de dependencia (requirements/poetry).
2. Sempre incluir exemplo de payload de execucao.
3. Sempre incluir comando de teste.
4. Nao alterar API publica do contrato sem versionar contract_version.

## Integracao com Go
1. Preservar compatibilidade com contract_version atual.
2. Tratar run_id e trace_id como obrigatorios de ponta a ponta.
3. Nunca retornar segredo no output_json.
