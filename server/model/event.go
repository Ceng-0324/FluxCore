package model

import "time"

const EventTypeCommitObserved = "commit_observed"

type Event struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	IdempotencyKey string    `gorm:"not null;uniqueIndex;size:200" json:"idempotency_key"`
	EventType      string    `gorm:"not null;size:80;index" json:"event_type"`
	Source         string    `gorm:"not null;size:80" json:"source"`
	ProjectID      uint      `gorm:"not null;index" json:"project_id"`
	RepositoryID   uint      `gorm:"not null;index" json:"repository_id"`
	BranchName     string    `gorm:"not null;size:255" json:"branch_name"`
	CommitSHA      string    `gorm:"not null;size:255;index" json:"commit_sha"`
	Payload        string    `gorm:"not null;type:text" json:"payload"`
	OccurredAt     time.Time `gorm:"not null;index" json:"occurred_at"`
	ReceivedAt     time.Time `gorm:"not null;index" json:"received_at"`
}
