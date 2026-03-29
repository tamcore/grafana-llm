package plugin

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// CheckHealth verifies the LLM endpoint is reachable and the API key is valid.
func (a *App) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	url := strings.TrimSuffix(a.settings.EndpointURL, "/") + "/models"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("create request: %v", err),
		}, nil
	}

	if a.settings.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.settings.APIKey)
	}

	client := &http.Client{Timeout: time.Duration(a.settings.TimeoutSeconds) * time.Second}

	resp, err := client.Do(req)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("connect to LLM endpoint: %v", err),
		}, nil
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("LLM endpoint returned status %d", resp.StatusCode),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: fmt.Sprintf("Connected to %s using model %s", a.settings.EndpointURL, a.settings.Model),
	}, nil
}
