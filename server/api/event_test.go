package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
)

func TestCreateEventIsIdempotentAndListable(t *testing.T) {
	router, _ := newTestRouter(t)
	projectID := createProject(t, router, "FluxCore")
	repositoryID := createRepository(t, router, projectID, "repo", "/repo", "git@example.com:repo.git")
	body := map[string]interface{}{
		"idempotency_key": "commit:1:abc", "event_type": "commit_observed", "source": "cli",
		"project_id": projectID, "repository_id": repositoryID, "branch_name": "main", "commit_sha": "abc",
		"payload": `{"subject":"first"}`, "occurred_at": "2026-09-24T10:00:00Z",
	}
	first := performJSONRequest(router, http.MethodPost, "/api/events", testAuthorizationHeader(), body)
	if first.Code != http.StatusCreated {
		t.Fatalf("first status = %d, body = %s", first.Code, first.Body.String())
	}
	second := performJSONRequest(router, http.MethodPost, "/api/events", testAuthorizationHeader(), body)
	if second.Code != http.StatusOK {
		t.Fatalf("second status = %d, body = %s", second.Code, second.Body.String())
	}
	list := performJSONRequest(router, http.MethodGet, "/api/projects/"+strconv.FormatUint(uint64(projectID), 10)+"/events", testAuthorizationHeader(), nil)
	if list.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", list.Code, list.Body.String())
	}
	var response struct {
		Events []json.RawMessage `json:"events"`
	}
	decodeResponse(t, list, &response)
	if len(response.Events) != 1 {
		t.Fatalf("events count = %d, want 1", len(response.Events))
	}
}
