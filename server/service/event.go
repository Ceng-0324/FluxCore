package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jaxson/FluxCore/server/model"
	"gorm.io/gorm"
)

var ErrEventConflict = errors.New("event conflicts with existing idempotency key")

type EventService struct{ conn *gorm.DB }

type CreateEventInput struct {
	IdempotencyKey string
	EventType      string
	Source         string
	ProjectID      uint
	RepositoryID   uint
	BranchName     string
	CommitSHA      string
	Payload        string
	OccurredAt     time.Time
}

func NewEventService(conn *gorm.DB) *EventService { return &EventService{conn: conn} }

func (svc *EventService) CreateEvent(input CreateEventInput) (model.Event, bool, error) {
	if svc == nil || svc.conn == nil {
		return model.Event{}, false, fmt.Errorf("database connection is nil")
	}
	if input.OccurredAt.IsZero() {
		return model.Event{}, false, fmt.Errorf("occurred_at is required")
	}
	receivedAt := time.Now().UTC()
	event := model.Event{
		IdempotencyKey: input.IdempotencyKey, EventType: input.EventType, Source: input.Source,
		ProjectID: input.ProjectID, RepositoryID: input.RepositoryID, BranchName: input.BranchName,
		CommitSHA: input.CommitSHA, Payload: input.Payload, OccurredAt: input.OccurredAt.UTC(), ReceivedAt: receivedAt,
	}
	if err := svc.conn.Create(&event).Error; err == nil {
		return event, true, nil
	} else if !errors.Is(err, gorm.ErrDuplicatedKey) {
		return model.Event{}, false, fmt.Errorf("create event: %w", err)
	}
	var existing model.Event
	if err := svc.conn.Where("idempotency_key = ?", input.IdempotencyKey).First(&existing).Error; err != nil {
		return model.Event{}, false, fmt.Errorf("read existing event: %w", err)
	}
	if existing.EventType != input.EventType || existing.Source != input.Source || existing.ProjectID != input.ProjectID || existing.RepositoryID != input.RepositoryID || existing.BranchName != input.BranchName || existing.CommitSHA != input.CommitSHA || existing.Payload != input.Payload || !existing.OccurredAt.Equal(input.OccurredAt.UTC()) {
		return model.Event{}, false, ErrEventConflict
	}
	return existing, false, nil
}

func (svc *EventService) ListEvents(projectID uint) ([]model.Event, error) {
	if svc == nil || svc.conn == nil {
		return nil, fmt.Errorf("database connection is nil")
	}
	var events []model.Event
	if err := svc.conn.Where("project_id = ?", projectID).Order("occurred_at ASC, id ASC").Find(&events).Error; err != nil {
		return nil, fmt.Errorf("list events: %w", err)
	}
	return events, nil
}

func ValidateEventPayload(payload string) error {
	var value any
	if err := json.Unmarshal([]byte(payload), &value); err != nil {
		return fmt.Errorf("payload must be valid JSON: %w", err)
	}
	return nil
}
