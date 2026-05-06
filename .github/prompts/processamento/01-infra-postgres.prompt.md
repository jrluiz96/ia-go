# Prompt de processamento - Etapa 01 (Infra PostgreSQL)

Implemente a etapa de infraestrutura do IA-GO no workspace atual.

Objetivo:
1. Ajustar docker-compose para subir postgres:16-alpine.
2. Configurar healthcheck.
3. Preparar volume persistente.
4. Criar migration inicial com tabelas bots, bot_versions, bot_runs, run_events.

Regras:
1. Nao versionar senha em texto puro.
2. Usar .env.local para variaveis locais.
3. Validar comandos de subida e saude do container.

Saida esperada:
1. Lista de arquivos criados/alterados.
2. Comandos executados.
3. Resultado dos checks.
4. Pendencias encontradas.
