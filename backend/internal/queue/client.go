package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	StreamAdHoc     = "ia_go:adhoc_jobs"
	StreamScheduled = "ia_go:scheduled_jobs"
	GroupWorker     = "ia_go_workers"
)

// Client encapsula operações de fila no Redis Streams.
type Client struct {
	rdb *redis.Client
}

func NewClient(addr, password string) *Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})
	return &Client{rdb: rdb}
}

// Ping verifica conectividade.
func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// Close fecha a conexão.
func (c *Client) Close() error {
	return c.rdb.Close()
}

// JobPayload é o envelope publicado na fila.
type JobPayload struct {
	RunID      string                 `json:"run_id"`
	BotID      string                 `json:"bot_id"`
	VersionID  string                 `json:"version_id,omitempty"`
	RunType    string                 `json:"run_type"`
	Params     map[string]interface{} `json:"params"`
	TraceID    string                 `json:"trace_id"`
	TimeoutSec int                    `json:"timeout_sec"`
	EnqueuedAt time.Time              `json:"enqueued_at"`
}

// Publish publica um job no stream especificado.
func (c *Client) Publish(ctx context.Context, stream string, payload JobPayload) (string, error) {
	payload.EnqueuedAt = time.Now()
	data, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("queue: marshal payload: %w", err)
	}

	msgID, err := c.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: map[string]interface{}{
			"payload": string(data),
		},
	}).Result()
	if err != nil {
		return "", fmt.Errorf("queue: publicar no stream %s: %w", stream, err)
	}

	return msgID, nil
}

// EnsureGroup garante que o consumer group existe no stream.
func (c *Client) EnsureGroup(ctx context.Context, stream, group string) error {
	err := c.rdb.XGroupCreateMkStream(ctx, stream, group, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return fmt.Errorf("queue: criar group %s: %w", group, err)
	}
	return nil
}

// Consume lê mensagens pendentes do consumer group.
func (c *Client) Consume(ctx context.Context, stream, group, consumer string, count int64) ([]redis.XMessage, error) {
	msgs, err := c.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    group,
		Consumer: consumer,
		Streams:  []string{stream, ">"},
		Count:    count,
		Block:    5 * time.Second,
	}).Result()
	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("queue: consumir stream: %w", err)
	}
	if len(msgs) == 0 {
		return nil, nil
	}
	return msgs[0].Messages, nil
}

// Ack confirma processamento de uma mensagem.
func (c *Client) Ack(ctx context.Context, stream, group, msgID string) error {
	return c.rdb.XAck(ctx, stream, group, msgID).Err()
}

// ParsePayload desserializa o payload de uma mensagem.
func ParsePayload(msg redis.XMessage) (*JobPayload, error) {
	raw, ok := msg.Values["payload"].(string)
	if !ok {
		return nil, fmt.Errorf("queue: campo payload ausente ou inválido")
	}
	var p JobPayload
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return nil, fmt.Errorf("queue: deserializar payload: %w", err)
	}
	return &p, nil
}
