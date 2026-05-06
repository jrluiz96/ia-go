package httpsrv

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Handlers struct {
	Bot      *BotHandler
	Run      *RunHandler
	Generate *GenerateHandler
	Schedule *ScheduleHandler
}

func NewRouter(h *Handlers) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/api/v1", func(r chi.Router) {
		// Geração por linguagem natural (TKT-002/003)
		r.Post("/generate", h.Generate.Generate)
		r.Post("/generate/preview", h.Generate.Preview)

		// Bots
		r.Post("/bots", h.Bot.Create)
		r.Get("/bots", h.Bot.List)
		r.Get("/bots/{botID}", h.Bot.Get)

		// Bot versions
		r.Post("/bots/{botID}/versions", h.Bot.CreateVersion)
		r.Get("/bots/{botID}/versions", h.Bot.ListVersions)
		r.Post("/bots/{botID}/versions/{versionID}/approve", h.Bot.ApproveVersion)
		r.Post("/bots/{botID}/versions/{versionID}/publish", h.Bot.PublishVersion)

		// Agendamentos
		r.Post("/bots/{botID}/schedules", h.Schedule.Create)
		r.Get("/bots/{botID}/schedules", h.Schedule.List)
		r.Patch("/bots/{botID}/schedules/{scheduleID}", h.Schedule.Toggle)

		// Test imediato
		r.Post("/bots/{botID}/ad-hoc-test", h.Run.AdHocTest)

		// Runs
		r.Get("/runs/{runID}", h.Run.Get)
		r.Get("/bots/{botID}/runs", h.Run.ListByBot)
		r.Get("/runs/{runID}/events", h.Run.GetEvents)
		r.Post("/runs/{runID}/status", h.Run.ReportStatus)
	})

	return r
}
