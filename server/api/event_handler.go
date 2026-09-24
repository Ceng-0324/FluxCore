package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jaxson/FluxCore/server/model"
	"github.com/jaxson/FluxCore/server/service"
)

type eventService interface {
	CreateEvent(service.CreateEventInput) (model.Event, bool, error)
	ListEvents(uint) ([]model.Event, error)
}

type createEventRequest struct {
	IdempotencyKey string    `json:"idempotency_key"`
	EventType      string    `json:"event_type"`
	Source         string    `json:"source"`
	ProjectID      uint      `json:"project_id"`
	RepositoryID   uint      `json:"repository_id"`
	BranchName     string    `json:"branch_name"`
	CommitSHA      string    `json:"commit_sha"`
	Payload        string    `json:"payload"`
	OccurredAt     time.Time `json:"occurred_at"`
}

func registerEventRoutes(group *gin.RouterGroup, events eventService) {
	group.POST("/events", createEventHandler(events))
	group.GET("/projects/:project_id/events", listEventsHandler(events))
}

func createEventHandler(events eventService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request createEventRequest
		if !decodeJSONBody(ctx, &request) {
			return
		}
		if strings.TrimSpace(request.IdempotencyKey) == "" || strings.TrimSpace(request.EventType) == "" || strings.TrimSpace(request.Source) == "" || request.ProjectID == 0 || request.RepositoryID == 0 || strings.TrimSpace(request.CommitSHA) == "" || request.OccurredAt.IsZero() {
			writeAPIError(ctx, http.StatusBadRequest, "invalid_request", "event identity and occurred_at are required")
			return
		}
		if err := service.ValidateEventPayload(request.Payload); err != nil {
			writeAPIError(ctx, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		event, created, err := events.CreateEvent(service.CreateEventInput{
			IdempotencyKey: request.IdempotencyKey, EventType: request.EventType, Source: request.Source,
			ProjectID: request.ProjectID, RepositoryID: request.RepositoryID, BranchName: request.BranchName,
			CommitSHA: request.CommitSHA, Payload: request.Payload, OccurredAt: request.OccurredAt,
		})
		if err != nil {
			writeServiceError(ctx, err)
			return
		}
		status := http.StatusCreated
		if !created {
			status = http.StatusOK
		}
		ctx.JSON(status, gin.H{"event": event, "created": created})
	}
}

func listEventsHandler(events eventService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		projectID, ok := projectIDFromPath(ctx)
		if !ok {
			return
		}
		items, err := events.ListEvents(projectID)
		if err != nil {
			writeServiceError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"events": items})
	}
}
