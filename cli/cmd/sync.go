package cmd

import (
	"context"
	"fmt"

	"github.com/jaxson/FluxCore/cli/internal/api"
	localconfig "github.com/jaxson/FluxCore/cli/internal/config"
	"github.com/jaxson/FluxCore/cli/internal/events"
	localgit "github.com/jaxson/FluxCore/cli/internal/git"
	"github.com/spf13/cobra"
)

func newSyncCommand(root *rootOptions) *cobra.Command {
	return &cobra.Command{
		Use: "sync", Short: "Deliver locally recorded facts to the FluxCore server",
		RunE: func(cmd *cobra.Command, args []string) error { return syncOutbox(cmd, root) },
	}
}

func syncOutbox(cmd *cobra.Command, rootOptions *rootOptions) error {
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
	store := localconfig.NewStore(repositoryRoot)
	cfg, err := store.Load()
	if err != nil {
		return err
	}
	if !cfg.IsLinked() {
		return fmt.Errorf("fluxcore repository is not linked; run fluxcore link first")
	}
	serverURL, token := cfg.ServerURL, cfg.Token
	if rootOptions.server != "" && rootOptions.server != defaultServerURL {
		serverURL = rootOptions.server
	}
	if rootOptions.token != "" {
		token = rootOptions.token
	}
	client, err := api.NewClient(serverURL, token)
	if err != nil {
		return err
	}
	outbox := events.NewStore(store)
	pending, err := outbox.List()
	if err != nil {
		return err
	}
	for _, event := range pending {
		_, _, err := client.CreateEvent(ctx, event)
		if err != nil {
			return fmt.Errorf("sync event %s: %w", event.IdempotencyKey, err)
		}
		if err := outbox.Remove(event.IdempotencyKey); err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "Synced event %s\n", event.IdempotencyKey)
	}
	if len(pending) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No pending events")
	}
	return nil
}
