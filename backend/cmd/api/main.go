package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ia-go/backend/internal/config"
	"ia-go/backend/internal/httpsrv"
	"ia-go/backend/internal/llm"
	"ia-go/backend/internal/queue"
	"ia-go/backend/internal/repository/postgres"
	"ia-go/backend/internal/service"
)

func main() {
	// Logs estruturados JSON (slog redireciona também o pacote log padrão)
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("falha ao carregar config: %v", err)
	}

	ctx := context.Background()

	db, err := postgres.Connect(ctx, cfg.Postgres.DSN())
	if err != nil {
		log.Fatalf("falha ao conectar ao postgres: %v", err)
	}
	defer db.Close()

	log.Println("postgres conectado com sucesso")

	// Redis / Fila
	queueClient := queue.NewClient(cfg.Redis.Addr(), cfg.Redis.Password)
	if err := queueClient.Ping(ctx); err != nil {
		log.Printf("aviso: redis indisponível: %v", err)
	} else {
		log.Println("redis conectado com sucesso")
		_ = queueClient.EnsureGroup(ctx, queue.StreamAdHoc, queue.GroupWorker)
		_ = queueClient.EnsureGroup(ctx, queue.StreamScheduled, queue.GroupWorker)
	}
	defer queueClient.Close()

	// LLM client
	var llmClient llm.Client
	if cfg.LLM.APIKey != "" || cfg.LLM.BaseURL != "" {
		llmClient = llm.NewOpenAIClient(cfg.LLM.BaseURL, cfg.LLM.APIKey, cfg.LLM.Model, cfg.LLM.Temperature)
		log.Printf("llm configurado: provider=%s model=%s url=%s", cfg.LLM.Provider, cfg.LLM.Model, cfg.LLM.BaseURL)
	} else {
		log.Println("aviso: LLM_API_KEY nem LLM_BASE_URL configurados — geração de bots desabilitada")
	}

	botRepo := postgres.NewBotRepo(db)
	runRepo := postgres.NewRunRepo(db)
	schedRepo := postgres.NewScheduleRepo(db)

	botSvc := service.NewBotService(botRepo, llmClient)
	scheduler := service.NewScheduler(botRepo, runRepo, schedRepo, queueClient)
	watchdog := service.NewWatchdog(runRepo)

	// Scheduler + Watchdog: goroutines, canceladas no shutdown
	schedCtx, schedCancel := context.WithCancel(ctx)
	go scheduler.Start(schedCtx)
	go watchdog.Start(schedCtx)

	handlers := &httpsrv.Handlers{
		Bot:      httpsrv.NewBotHandler(botRepo),
		Run:      httpsrv.NewRunHandler(runRepo, botRepo, queueClient),
		Generate: httpsrv.NewGenerateHandler(botSvc),
		Schedule: httpsrv.NewScheduleHandler(schedRepo),
	}

	router := httpsrv.NewRouter(handlers)

	addr := fmt.Sprintf(":%d", cfg.API.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("api ia-go iniciada em %s (env=%s)", addr, cfg.API.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("falha ao iniciar servidor: %v", err)
		}
	}()

	<-quit
	log.Println("encerrando servidor...")
	schedCancel() // para o scheduler e o watchdog

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("erro no shutdown: %v", err)
	}

	log.Println("servidor encerrado")
}
