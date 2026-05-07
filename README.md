# IA-GO

Plataforma de automação de navegador gerada por IA. Um LLM gera bots Python (Playwright) a partir de linguagem natural; o backend Go orquestra execução, agendamento, retry e observabilidade.

## Arquitetura

```
Frontend (Nginx) ──► Backend Go (API) ──► Redis Streams ──► Worker Python (Playwright)
                          │
                     PostgreSQL
```

| Componente | Tecnologia | Porta |
|---|---|---|
| Frontend | Nginx + Vanilla JS | 9224 |
| API | Go 1.22 + chi v5 | 8080 |
| Worker | Python 3.11 + Playwright | — |
| Banco | PostgreSQL 16 | 5432 |
| Fila | Redis 7 | 6379 |

---

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Go 1.22+](https://go.dev/dl/)
- [Python 3.11+](https://www.python.org/)

---

## Subindo o ambiente

### 1. Variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
POSTGRES_DB=ia_go
POSTGRES_USER=ia_go_user
POSTGRES_PASSWORD=ia_go_pass
POSTGRES_PORT=5432
REDIS_PORT=6379
```

### 2. Subir PostgreSQL e Redis

```powershell
docker-compose up -d postgres redis
```

### 3. Aplicar migrations

```powershell
Get-Content backend/migrations/001_initial.sql   | docker exec -i ia-go-postgres-1 psql -U ia_go_user -d ia_go
Get-Content backend/migrations/002_sprint3.sql   | docker exec -i ia-go-postgres-1 psql -U ia_go_user -d ia_go
Get-Content backend/migrations/003_v01_closing.sql | docker exec -i ia-go-postgres-1 psql -U ia_go_user -d ia_go
```

### 4. Subir o backend Go

```powershell
cd backend
go run ./cmd/api
```

A API ficará disponível em `http://localhost:8080`.

### 5. Subir o worker Python

```powershell
cd worker
pip install -r requirements.txt
playwright install chromium
python main.py
```

### 6. Subir o frontend

```powershell
docker-compose up -d front
```

Acesse: **http://localhost:9224/app/**

### Subir tudo de uma vez (exceto API Go)

```powershell
docker-compose up -d
```

---

## Uso

### Criando um bot

1. Acesse **http://localhost:9224/app/**
2. Menu **Criar Bot** → descreva o que o bot deve fazer em linguagem natural
3. Clique em **Gerar** — o LLM cria o código Python automaticamente
4. Revise o código gerado e clique em **Salvar como Rascunho**
5. Clique em **Aprovar** e depois **Publicar** para ativar o bot

### Executando manualmente

Na tela de criação, após gerar ou carregar um bot, clique em **Testar agora**.  
A execução aparece em tempo real na aba **Execuções**.

### Agendando execução (cron)

Via API:

```bash
curl -X POST http://localhost:8080/api/v1/bots/{botID}/schedules \
  -H "Content-Type: application/json" \
  -d '{"cron_expr": "0 9 * * 1-5", "timezone": "America/Sao_Paulo"}'
```

O scheduler verifica agendamentos a cada 30 segundos e despacha execuções para a fila.

### Rollback de versão

1. Aba **Meus Bots** → botão **Versões** no card do bot
2. O modal lista todas as versões com status
3. Versões `archived` ou `approved` têm o botão **↩ Rollback**
4. Ao confirmar, a versão selecionada volta a ser `published` e a atual vira `archived`

Via API:

```bash
curl -X POST http://localhost:8080/api/v1/bots/{botID}/versions/{versionID}/rollback \
  -H "Content-Type: application/json" \
  -d '{"rolled_back_by": "seu_nome"}'
```

### Painel Operacional

Menu **Operacional** → exibe contagem de runs por status e runs travadas (sem heartbeat há mais de 5 min).

---

## Fluxo de ciclo de vida de uma versão

```
draft ──[Aprovar]──► approved ──[Publicar]──► published
                                                  │
                                          (nova publicação)
                                                  ▼
                                             archived ──[Rollback]──► published
```

---

## Testes

### Backend Go

```powershell
cd backend
go test ./...
```

### Worker Python

```powershell
cd worker
python -m pytest -v
```

---

## Variáveis de ambiente do worker

| Variável | Descrição | Padrão |
|---|---|---|
| `REDIS_HOST` | Host do Redis | `localhost` |
| `REDIS_PORT` | Porta do Redis | `6379` |
| `API_BASE_URL` | URL base da API Go | `http://localhost:8080` |
| `SECRET_<ID>` | Credencial resolvida por `secret_id` | — |

Credenciais no formato `usuario:senha` ou apenas `token`.  
Exemplo: `SECRET_MEU_BOT_CRED=admin:senha123`

---

## Segurança

- Credenciais nunca aparecem em logs ou no output JSON das runs
- Mensagens de erro são sanitizadas antes de persistir (`password=`, `token=`, `Bearer ...` → `[MASKED]`)
- Versões só podem ser publicadas após aprovação explícita (`draft → approved → published`)
- `retryable_error` não é aceito como status terminal pela API (apenas o worker pode reportá-lo internamente)
