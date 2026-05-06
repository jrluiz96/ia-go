# Prompt de processamento - Etapa 02 (Backend Go)

Implemente backend Go v0.1 do IA-GO no workspace atual.

Objetivo:
1. Inicializar modulo Go e estrutura de pastas.
2. Implementar conexao PostgreSQL.
3. Criar endpoints minimos:
- POST /bots
- POST /bots/{id}/versions
- POST /bots/{id}/ad-hoc-test
- POST /bots/{id}/publish
- GET /runs
4. Validar contrato v1.

Regras:
1. Runtime deterministico, sem decisao por IA em producao.
2. Logs com trace_id e run_id.
3. Erros mapeados para retryable_error/fatal_error.

Saida esperada:
1. Arquivos criados/alterados.
2. Endpoints implementados.
3. Como executar local.
4. Testes basicos executados.
