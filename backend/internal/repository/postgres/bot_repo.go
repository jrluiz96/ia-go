package postgres

import (
	"context"
	"encoding/json"
	"time"

	"ia-go/backend/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BotRepo struct {
	db *pgxpool.Pool
}

func NewBotRepo(db *pgxpool.Pool) *BotRepo {
	return &BotRepo{db: db}
}

func (r *BotRepo) Create(ctx context.Context, input domain.CreateBotInput) (*domain.Bot, error) {
	const q = `
		INSERT INTO bots (name, description, owner_id)
		VALUES ($1, $2, $3)
		RETURNING id, name, description, owner_id, active, created_at, updated_at`

	bot := &domain.Bot{}
	err := r.db.QueryRow(ctx, q, input.Name, input.Description, input.OwnerID).
		Scan(&bot.ID, &bot.Name, &bot.Description, &bot.OwnerID, &bot.Active, &bot.CreatedAt, &bot.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return bot, nil
}

func (r *BotRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Bot, error) {
	const q = `
		SELECT id, name, description, owner_id, active, created_at, updated_at
		FROM bots WHERE id = $1`

	bot := &domain.Bot{}
	err := r.db.QueryRow(ctx, q, id).
		Scan(&bot.ID, &bot.Name, &bot.Description, &bot.OwnerID, &bot.Active, &bot.CreatedAt, &bot.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return bot, nil
}

func (r *BotRepo) List(ctx context.Context) ([]*domain.Bot, error) {
	const q = `
		SELECT id, name, description, owner_id, active, created_at, updated_at
		FROM bots ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bots []*domain.Bot
	for rows.Next() {
		bot := &domain.Bot{}
		if err := rows.Scan(&bot.ID, &bot.Name, &bot.Description, &bot.OwnerID, &bot.Active, &bot.CreatedAt, &bot.UpdatedAt); err != nil {
			return nil, err
		}
		bots = append(bots, bot)
	}
	return bots, nil
}

func (r *BotRepo) CreateVersion(ctx context.Context, input domain.CreateVersionInput) (*domain.BotVersion, error) {
	contractBytes, err := json.Marshal(input.ContractJSON)
	if err != nil {
		return nil, err
	}

	const q = `
		INSERT INTO bot_versions (bot_id, version, code_python, contract_json, status, created_by)
		VALUES ($1,
			COALESCE((SELECT MAX(version) FROM bot_versions WHERE bot_id = $1), 0) + 1,
			$2, $3, 'draft', $4)
		RETURNING id, bot_id, version, code_python, contract_json, status, created_by, approved_by, published_at, created_at, updated_at`

	v := &domain.BotVersion{}
	var contractRaw []byte
	var approvedBy *string
	var publishedAt *time.Time

	err = r.db.QueryRow(ctx, q, input.BotID, input.CodePython, contractBytes, input.CreatedBy).
		Scan(&v.ID, &v.BotID, &v.Version, &v.CodePython, &contractRaw,
			&v.Status, &v.CreatedBy, &approvedBy, &publishedAt, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if approvedBy != nil {
		v.ApprovedBy = *approvedBy
	}
	v.PublishedAt = publishedAt

	if err := json.Unmarshal(contractRaw, &v.ContractJSON); err != nil {
		return nil, err
	}

	return v, nil
}

func (r *BotRepo) GetVersion(ctx context.Context, botID, versionID uuid.UUID) (*domain.BotVersion, error) {
	const q = `
		SELECT id, bot_id, version, code_python, contract_json, status, created_by,
		       approved_by, published_at, created_at, updated_at
		FROM bot_versions WHERE id = $1 AND bot_id = $2`

	v := &domain.BotVersion{}
	var contractRaw []byte
	var approvedBy *string
	var publishedAt *time.Time

	err := r.db.QueryRow(ctx, q, versionID, botID).
		Scan(&v.ID, &v.BotID, &v.Version, &v.CodePython, &contractRaw,
			&v.Status, &v.CreatedBy, &approvedBy, &publishedAt, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if approvedBy != nil {
		v.ApprovedBy = *approvedBy
	}
	v.PublishedAt = publishedAt

	if err := json.Unmarshal(contractRaw, &v.ContractJSON); err != nil {
		return nil, err
	}

	return v, nil
}

func (r *BotRepo) UpdateVersionStatus(ctx context.Context, versionID uuid.UUID, status domain.BotStatus, by string) error {
	var q string
	if status == domain.BotStatusPublished {
		q = `UPDATE bot_versions SET status = $1, approved_by = $2, published_at = NOW(), updated_at = NOW() WHERE id = $3`
	} else if status == domain.BotStatusApproved {
		q = `UPDATE bot_versions SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $3`
	} else {
		q = `UPDATE bot_versions SET status = $1, approved_by = $2, updated_at = NOW() WHERE id = $3`
	}
	_, err := r.db.Exec(ctx, q, status, by, versionID)
	return err
}

// GetPublishedVersion retorna a versão published de um bot, se existir.
func (r *BotRepo) GetPublishedVersion(ctx context.Context, botID uuid.UUID) (*domain.BotVersion, error) {
	const q = `
		SELECT id, bot_id, version, code_python, contract_json, status, created_by,
		       approved_by, published_at, created_at, updated_at
		FROM bot_versions WHERE bot_id = $1 AND status = 'published' LIMIT 1`

	v := &domain.BotVersion{}
	var contractRaw []byte
	var approvedBy *string
	var publishedAt *time.Time

	err := r.db.QueryRow(ctx, q, botID).
		Scan(&v.ID, &v.BotID, &v.Version, &v.CodePython, &contractRaw,
			&v.Status, &v.CreatedBy, &approvedBy, &publishedAt, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if approvedBy != nil {
		v.ApprovedBy = *approvedBy
	}
	v.PublishedAt = publishedAt

	if err := json.Unmarshal(contractRaw, &v.ContractJSON); err != nil {
		return nil, err
	}
	return v, nil
}

// ArchiveCurrentPublished arquiva a versão published atual do bot (se existir).
// Deve ser chamado antes de publicar uma nova versão.
func (r *BotRepo) ArchiveCurrentPublished(ctx context.Context, botID uuid.UUID) error {
	const q = `
		UPDATE bot_versions SET status = 'archived', updated_at = NOW()
		WHERE bot_id = $1 AND status = 'published'`
	_, err := r.db.Exec(ctx, q, botID)
	return err
}

// ListVersionsByBot retorna todas as versões de um bot, ordenadas pela mais recente.
func (r *BotRepo) ListVersionsByBot(ctx context.Context, botID uuid.UUID) ([]*domain.BotVersion, error) {
	const q = `
		SELECT id, bot_id, version, code_python, contract_json, status, created_by,
		       approved_by, published_at, created_at, updated_at
		FROM bot_versions WHERE bot_id = $1 ORDER BY version DESC`

	rows, err := r.db.Query(ctx, q, botID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []*domain.BotVersion
	for rows.Next() {
		v := &domain.BotVersion{}
		var contractRaw []byte
		var approvedBy *string
		var publishedAt *time.Time

		if err := rows.Scan(&v.ID, &v.BotID, &v.Version, &v.CodePython, &contractRaw,
			&v.Status, &v.CreatedBy, &approvedBy, &publishedAt, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		if approvedBy != nil {
			v.ApprovedBy = *approvedBy
		}
		v.PublishedAt = publishedAt
		if contractRaw != nil {
			_ = json.Unmarshal(contractRaw, &v.ContractJSON)
		}
		versions = append(versions, v)
	}
	return versions, nil
}
