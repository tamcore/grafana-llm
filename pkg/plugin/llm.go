package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	openai "github.com/sashabaranov/go-openai"
)

// chatCompletion sends a chat completion request to the configured LLM endpoint.
func (a *App) chatCompletion(ctx context.Context, req ChatRequest) (string, *Usage, error) {
	systemPrompt := buildSystemPrompt(req.Mode, req.Context)

	messages := []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
		{Role: openai.ChatMessageRoleUser, Content: req.Prompt},
	}

	config := openai.DefaultConfig(a.settings.APIKey)
	config.BaseURL = strings.TrimSuffix(a.settings.EndpointURL, "/")

	client := openai.NewClientWithConfig(config)

	resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:     a.settings.Model,
		Messages:  messages,
		MaxTokens: a.settings.MaxTokens,
	})
	if err != nil {
		return "", nil, fmt.Errorf("create chat completion: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", nil, fmt.Errorf("no choices in response")
	}

	usage := &Usage{
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
	}

	return resp.Choices[0].Message.Content, usage, nil
}

func buildSystemPrompt(mode string, contextData json.RawMessage) string {
	var contextStr string
	if len(contextData) > 0 {
		contextStr = string(contextData)
	}

	switch mode {
	case "explain_panel":
		return fmt.Sprintf(`You are a Grafana panel analysis assistant. Explain what the following panel shows, highlight notable patterns, and flag potential concerns.

Panel context:
%s`, contextStr)

	case "summarize_dashboard":
		return fmt.Sprintf(`You are a Grafana dashboard analysis assistant. Provide a concise summary of this dashboard: its purpose, key metrics, current state, and any anomalies.

Dashboard context:
%s`, contextStr)

	case "analyze_logs":
		return fmt.Sprintf(`You are a log analysis assistant for Grafana/Loki. Analyze the following logs, identify patterns, categorize errors, and suggest root causes.

Log context:
%s`, contextStr)

	case "analyze_metrics":
		return fmt.Sprintf(`You are a metrics analysis assistant for Grafana/Prometheus. Analyze the following metrics data, identify trends, detect anomalies, and provide recommendations.

Metrics context:
%s`, contextStr)

	default:
		return "You are a helpful Grafana analysis assistant."
	}
}
