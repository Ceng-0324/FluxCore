package service

import (
	"testing"
	"time"

	"github.com/jaxson/FluxCore/server/model"
)

func TestCreateEventIsIdempotent(t *testing.T) {
	conn := openTestDB(t)
	if err := Migrate(conn); err != nil {
		t.Fatal(err)
	}
	project := model.Project{Name: "FluxCore", Status: model.ProjectStatusActive}
	if err := conn.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	repository := model.Repository{ProjectID: project.ID, Name: "repo", LocalPath: "/repo", RemoteURL: "git@example.com:repo.git", DefaultBranch: "main"}
	if err := conn.Create(&repository).Error; err != nil {
		t.Fatal(err)
	}
	svc := NewEventService(conn)
	input := CreateEventInput{IdempotencyKey: "commit:1:abc", EventType: model.EventTypeCommitObserved, Source: "cli", ProjectID: project.ID, RepositoryID: repository.ID, BranchName: "main", CommitSHA: "abc", Payload: `{ "subject": "first" }`, OccurredAt: time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC)}
	first, created, err := svc.CreateEvent(input)
	if err != nil || !created {
		t.Fatalf("first create = %#v, %t, %v", first, created, err)
	}
	second, created, err := svc.CreateEvent(input)
	if err != nil || created {
		t.Fatalf("second create = %#v, %t, %v", second, created, err)
	}
	if second.ID != first.ID {
		t.Fatalf("duplicate ID = %d, want %d", second.ID, first.ID)
	}
	var count int64
	if err := conn.Model(&model.Event{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("event count = %d, want 1", count)
	}
}
