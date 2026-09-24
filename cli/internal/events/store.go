package events

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/jaxson/FluxCore/cli/internal/api"
	"github.com/jaxson/FluxCore/cli/internal/config"
)

type Store struct{ path string }

func NewStore(configStore config.Store) Store { return Store{path: configStore.OutboxPath()} }

func (store Store) Save(event api.CreateEventInput) (string, error) {
	if event.IdempotencyKey == "" {
		return "", fmt.Errorf("event idempotency key is required")
	}
	if err := os.MkdirAll(store.path, 0o700); err != nil {
		return "", fmt.Errorf("create event outbox: %w", err)
	}
	data, err := json.MarshalIndent(event, "", "  ")
	if err != nil {
		return "", fmt.Errorf("encode event: %w", err)
	}
	name := filepath.Join(store.path, event.IdempotencyKey+".json")
	temporary, err := os.CreateTemp(store.path, ".event-*.tmp")
	if err != nil {
		return "", fmt.Errorf("create event temporary file: %w", err)
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return "", fmt.Errorf("protect event temporary file: %w", err)
	}
	if _, err := temporary.Write(append(data, '\n')); err != nil {
		_ = temporary.Close()
		return "", fmt.Errorf("write event: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return "", fmt.Errorf("close event temporary file: %w", err)
	}
	if err := os.Rename(temporaryName, name); err != nil {
		return "", fmt.Errorf("publish event: %w", err)
	}
	return name, nil
}

func (store Store) List() ([]api.CreateEventInput, error) {
	entries, err := os.ReadDir(store.path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read event outbox: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	result := make([]api.CreateEventInput, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(store.path, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read event %s: %w", entry.Name(), err)
		}
		var event api.CreateEventInput
		if err := json.Unmarshal(data, &event); err != nil {
			return nil, fmt.Errorf("parse event %s: %w", entry.Name(), err)
		}
		result = append(result, event)
	}
	return result, nil
}

func (store Store) Remove(idempotencyKey string) error {
	if err := os.Remove(filepath.Join(store.path, idempotencyKey+".json")); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove event: %w", err)
	}
	return nil
}
