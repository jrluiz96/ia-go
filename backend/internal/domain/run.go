package domain

import (
	"time"

	"github.com/google/uuid"
)

type RunStatus string
type RunType string

const (
	RunStatusQueued         RunStatus = "queued"
	RunStatusRunning        RunStatus = "running"
	RunStatusSuccess        RunStatus = "success"
	RunStatusRetryableError RunStatus = "retryable_error"
	RunStatusFatalError     RunStatus = "fatal_error"
	RunStatusCanceled       RunStatus = "canceled"

	RunTypeScheduled RunType = "scheduled"
	RunTypeAdHocTest RunType = "ad_hoc_test"
)

// BotRun representa uma execução de bot.
type BotRun struct {
	ID            uuid.UUID              `json:"id"`
	RunID         string                 `json:"run_id"`
	BotID         uuid.UUID              `json:"bot_id"`
	BotVersionID  *uuid.UUID             `json:"bot_version_id,omitempty"`
	RunType       RunType                `json:"run_type"`
	Status        RunStatus              `json:"status"`
	ScheduledAt   *time.Time             `json:"scheduled_at,omitempty"`
	StartedAt     *time.Time             `json:"started_at,omitempty"`
	FinishedAt    *time.Time             `json:"finished_at,omitempty"`
	LastHeartbeat *time.Time             `json:"last_heartbeat,omitempty"`
	InputJSON     map[string]interface{} `json:"input_json,omitempty"`
	OutputJSON    map[string]interface{} `json:"output_json,omitempty"`
	ErrorCode     string                 `json:"error_code,omitempty"`
	ErrorMessage  string                 `json:"error_message,omitempty"`
	WorkerID      string                 `json:"worker_id,omitempty"`
	TraceID       string                 `json:"trace_id"`
	Attempt       int                    `json:"attempt"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

// RunEvent representa um evento de log de uma execução.
type RunEvent struct {
	ID       uuid.UUID              `json:"id"`
	RunID    string                 `json:"run_id"`
	Ts       time.Time              `json:"ts"`
	Level    string                 `json:"level"`
	Message  string                 `json:"message"`
	DataJSON map[string]interface{} `json:"data_json,omitempty"`
}

// AdHocTestInput é o payload para disparar um teste imediato.
type AdHocTestInput struct {
	BotID        uuid.UUID              `json:"bot_id"`
	BotVersionID uuid.UUID              `json:"bot_version_id"`
	Params       map[string]interface{} `json:"params"`
	TraceID      string                 `json:"trace_id"`
	TimeoutSec   int                    `json:"timeout_sec"`
}

// ContractV1 é o envelope de entrada para o worker Python.
type ContractV1 struct {
	ContractVersion string                 `json:"contract_version"`
	RunID           string                 `json:"run_id"`
	BotID           string                 `json:"bot_id"`
	BotVersion      int                    `json:"bot_version"`
	RunType         RunType                `json:"run_type"`
	Params          map[string]interface{} `json:"params"`
	AuthProfile     map[string]interface{} `json:"auth_profile,omitempty"`
	ExecutionCtx    ExecutionContext       `json:"execution_context"`
	RetryPolicy     RetryPolicy            `json:"retry_policy"`
	Trace           TraceInfo              `json:"trace"`
}

type ExecutionContext struct {
	TimeoutSec   int      `json:"timeout_sec"`
	Capabilities []string `json:"capabilities"`
	WorkerType   string   `json:"worker_type"`
}

type RetryPolicy struct {
	MaxAttempts int    `json:"max_attempts"`
	BackoffSec  int    `json:"backoff_sec"`
	RetryOn     string `json:"retry_on"`
}

type TraceInfo struct {
	TraceID string `json:"trace_id"`
	RunID   string `json:"run_id"`
}

// WorkerOutputV1 é o envelope de saída do worker Python.
type WorkerOutputV1 struct {
	RunID        string                 `json:"run_id"`
	Status       RunStatus              `json:"status"`
	Result       map[string]interface{} `json:"result,omitempty"`
	Artifacts    []Artifact             `json:"artifacts,omitempty"`
	ErrorCode    string                 `json:"error_code,omitempty"`
	ErrorMessage string                 `json:"error_message,omitempty"`
	Metrics      RunMetrics             `json:"metrics"`
}

type Artifact struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content,omitempty"`
	URL     string `json:"url,omitempty"`
}

type RunMetrics struct {
	DurationMs int `json:"duration_ms"`
	Steps      int `json:"steps"`
}
