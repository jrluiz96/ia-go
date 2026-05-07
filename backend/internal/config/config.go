package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	API      APIConfig
	Postgres PostgresConfig
	Redis    RedisConfig
	LLM      LLMConfig
}

type APIConfig struct {
	Port int
	Env  string
}

type PostgresConfig struct {
	Host     string
	Port     int
	DB       string
	User     string
	Password string
}

func (p PostgresConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=disable",
		p.Host, p.Port, p.DB, p.User, p.Password,
	)
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
}

func (r RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

type LLMConfig struct {
	Provider    string
	APIKey      string
	BaseURL     string
	Model       string
	Temperature float64
}

func Load() (*Config, error) {
	// Tenta carregar .env.local; ignora erro se não existir (ex: container)
	_ = godotenv.Load("../.env.local")
	_ = godotenv.Load(".env.local")

	cfg := &Config{
		API: APIConfig{
			Port: envInt("API_PORT", 8080),
			Env:  envStr("API_ENV", "development"),
		},
		Postgres: PostgresConfig{
			Host:     envStr("POSTGRES_HOST", "localhost"),
			Port:     envInt("POSTGRES_PORT", 5432),
			DB:       envStr("POSTGRES_DB", "ia_go"),
			User:     envStr("POSTGRES_USER", "ia_go_user"),
			Password: envStr("POSTGRES_PASSWORD", ""),
		},
		Redis: RedisConfig{
			Host:     envStr("REDIS_HOST", "localhost"),
			Port:     envInt("REDIS_PORT", 6379),
			Password: envStr("REDIS_PASSWORD", ""),
		},
		LLM: LLMConfig{
			Provider:    envStr("LLM_PROVIDER", "openai"),
			APIKey:      envStr("LLM_API_KEY", ""),
			BaseURL:     envStr("LLM_BASE_URL", ""),
			Model:       envStr("LLM_MODEL", "gpt-4o-mini"),
			Temperature: envFloat("LLM_TEMPERATURE", 0.2),
		},
	}

	return cfg, nil
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	return f
}
