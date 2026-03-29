package plugin

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	defaultTimeoutSeconds   = 60
	defaultMaxTokens        = 4096
	defaultMaxContextTokens = 120000
)

// Settings holds the plugin configuration parsed from Grafana's jsonData and secureJsonData.
type Settings struct {
	EndpointURL      string            `json:"endpointURL"`
	Model            string            `json:"model"`
	TimeoutSeconds   int               `json:"timeoutSeconds"`
	MaxTokens        int               `json:"maxTokens"`
	MaxContextTokens int               `json:"maxContextTokens"`
	CustomHeaders    map[string]string `json:"customHeaders,omitempty"`
	GrafanaURL       string            `json:"grafanaURL,omitempty"`
	APIKey           string            `json:"-"`
}

// App is the main plugin instance.
type App struct {
	httpHandler  backend.CallResourceHandler
	settings     Settings
	logger       log.Logger
	metrics      *metrics
	toolExecutor *ToolExecutor
}

// NewApp creates a new plugin instance from the given settings.
func NewApp(_ context.Context, appSettings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.DefaultLogger
	logger.Info("Creating new plugin instance", "updated", appSettings.Updated)

	var settings Settings
	if err := json.Unmarshal(appSettings.JSONData, &settings); err != nil {
		return nil, fmt.Errorf("unmarshal settings: %w", err)
	}

	if settings.TimeoutSeconds <= 0 {
		settings.TimeoutSeconds = defaultTimeoutSeconds
	}

	if settings.MaxTokens <= 0 {
		settings.MaxTokens = defaultMaxTokens
	}

	if settings.MaxContextTokens <= 0 {
		settings.MaxContextTokens = defaultMaxContextTokens
	}

	if apiKey, ok := appSettings.DecryptedSecureJSONData["apiKey"]; ok {
		settings.APIKey = apiKey
	}

	grafanaURL := settings.GrafanaURL
	if grafanaURL == "" {
		grafanaURL = "http://localhost:3000"
	}

	te := NewToolExecutor(grafanaURL, logger)

	app := &App{
		settings:     settings,
		logger:       logger,
		metrics:      newMetrics(prometheus.NewRegistry()),
		toolExecutor: te,
	}

	app.registerRoutes()

	return app, nil
}

// Dispose cleans up resources on plugin shutdown.
func (a *App) Dispose() {}
