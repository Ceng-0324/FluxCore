package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jaxson/FluxCore/cli/internal/api"
	localconfig "github.com/jaxson/FluxCore/cli/internal/config"
	"github.com/jaxson/FluxCore/cli/internal/events"
	localgit "github.com/jaxson/FluxCore/cli/internal/git"
	"github.com/spf13/cobra"
)

func newObserveCommand(root *rootOptions) *cobra.Command {
	observe := &cobra.Command{Use: "observe", Short: "Record local Git facts without waiting for the server"}
	observe.AddCommand(&cobra.Command{
		Use: "commit", Short: "Record the current HEAD commit in the local outbox",
		RunE: func(cmd *cobra.Command, args []string) error { return observeCommit(cmd, root) },
	})
	return observe
}

func observeCommit(cmd *cobra.Command, rootOptions *rootOptions) error {
	ctx, cancel := context.WithTimeout(cmd.Context(), commandTimeout)
	defer cancel()
	workingDir, err := rootOptions.workingDir()
	if err != nil {
		return fmt.Errorf("read working directory: %w", err)
	}
	inspector := localgit.NewInspector(workingDir)
	repositoryRoot, err := inspector.RepositoryRoot(ctx)
	if err != nil {
		return err
	}
	cfg, err := localconfig.NewStore(repositoryRoot).Load()
	if err != nil {
		return err
	}
	if !cfg.IsLinked() {
		return fmt.Errorf("fluxcore repository is not linked; run fluxcore link first")
	}
	branch, err := inspector.CurrentBranch(ctx, repositoryRoot)
	if err != nil {
		return err
	}
	commit, err := inspector.HeadCommit(ctx, repositoryRoot)
	if err != nil {
		return err
	}
	occurredAt, err := time.Parse(time.RFC3339, commit.OccurredAt)
	if err != nil {
		return fmt.Errorf("parse commit time: %w", err)
	}
	payload, err := json.Marshal(map[string]string{"subject": commit.Subject})
	if err != nil {
		return fmt.Errorf("encode commit payload: %w", err)
	}
	event := api.CreateEventInput{
		IdempotencyKey: "commit:" + fmt.Sprint(cfg.Repository.ID) + ":" + commit.SHA,
		EventType:      api.EventTypeCommitObserved, Source: "cli", ProjectID: cfg.Project.ID, RepositoryID: cfg.Repository.ID,
		BranchName: branch, CommitSHA: commit.SHA, Payload: string(payload), OccurredAt: occurredAt,
	}
	path, err := events.NewStore(localconfig.NewStore(repositoryRoot)).Save(event)
	if err != nil {
		return err
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Recorded commit %s in local outbox: %s\n", commit.SHA, path)
	return nil
}
