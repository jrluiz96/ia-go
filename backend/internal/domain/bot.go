package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrInvalidTransition é retornado quando a transição de estado solicitada é inválida.
var ErrInvalidTransition = errors.New("transição de estado inválida")

type BotStatus string

const (
	BotStatusDraft     BotStatus = "draft"
	BotStatusApproved  BotStatus = "approved"
	BotStatusPublished BotStatus = "published"
	BotStatusArchived  BotStatus = "archived"
)

type Bot struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerID     string    `json:"owner_id"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type BotVersion struct {
	ID           uuid.UUID              `json:"id"`
	BotID        uuid.UUID              `json:"bot_id"`
	Version      int                    `json:"version"`
	CodePython   string                 `json:"code_python"`
	ContractJSON map[string]interface{} `json:"contract_json"`
	Status       BotStatus              `json:"status"`
	CreatedBy    string                 `json:"created_by"`
	ApprovedBy   string                 `json:"approved_by,omitempty"`
	PublishedAt  *time.Time             `json:"published_at,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

type BotSchedule struct {
	ID        uuid.UUID  `json:"id"`
	BotID     uuid.UUID  `json:"bot_id"`
	CronExpr  string     `json:"cron_expr"`
	Timezone  string     `json:"timezone"`
	NextRunAt *time.Time `json:"next_run_at,omitempty"`
	Enabled   bool       `json:"enabled"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type CreateBotInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	OwnerID     string `json:"owner_id"`
}

type CreateVersionInput struct {
	BotID        uuid.UUID              `json:"bot_id"`
	CodePython   string                 `json:"code_python"`
	ContractJSON map[string]interface{} `json:"contract_json"`
	CreatedBy    string                 `json:"created_by"`
}

type CreateScheduleInput struct {
	BotID    uuid.UUID `json:"bot_id"`
	CronExpr string    `json:"cron_expr"`
	Timezone string    `json:"timezone"`
}
