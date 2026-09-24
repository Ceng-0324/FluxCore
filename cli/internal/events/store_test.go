package events

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jaxson/FluxCore/cli/internal/api"
	"github.com/jaxson/FluxCore/cli/internal/config"
)

func TestStorePersistsAndListsEventsUntilRemoved(t *testing.T) {
	root := t.TempDir()
	store := NewStore(config.NewStore(root))
	event := api.CreateEventInput{IdempotencyKey: "commit:7:abc", EventType: api.EventTypeCommitObserved, Source: "cli", ProjectID: 7, RepositoryID: 8, BranchName: "main", CommitSHA: "abc", Payload: `{"subject":"first"}`, OccurredAt: time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC)}
	path, err := store.Save(event)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
	pending, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) != 1 || pending[0].IdempotencyKey != event.IdempotencyKey {
		t.Fatalf("pending = %#v", pending)
	}
	if err := store.Remove(event.IdempotencyKey); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Dir(path)); err != nil {
		t.Fatal(err)
	}
	pending, err = store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) != 0 {
		t.Fatalf("pending after remove = %#v", pending)
	}
}
