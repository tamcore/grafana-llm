package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	openai "github.com/sashabaranov/go-openai"
)

// streamChatCompletion sends a streaming chat completion request and relays chunks via the sender.
func (a *App) streamChatCompletion(ctx context.Context, req ChatRequest, sender backend.CallResourceResponseSender) error {
	systemPrompt := buildSystemPrompt(req.Mode, req.Context)

	messages := []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
		{Role: openai.ChatMessageRoleUser, Content: req.Prompt},
	}

	config := openai.DefaultConfig(a.settings.APIKey)
	config.BaseURL = strings.TrimSuffix(a.settings.EndpointURL, "/")

	client := openai.NewClientWithConfig(config)

	stream, err := client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
		Model:     a.settings.Model,
		Messages:  messages,
		MaxTokens: a.settings.MaxTokens,
		Stream:    true,
	})
	if err != nil {
		return fmt.Errorf("create chat completion stream: %w", err)
	}
	defer func() { _ = stream.Close() }()

	for {
		response, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return sendStreamChunk(sender, ChatResponse{
				Content: "",
				Done:    true,
			})
		}
		if err != nil {
			return fmt.Errorf("recv stream chunk: %w", err)
		}

		if len(response.Choices) > 0 {
			chunk := ChatResponse{
				Content: response.Choices[0].Delta.Content,
				Done:    false,
			}
			if err := sendStreamChunk(sender, chunk); err != nil {
				return err
			}
		}
	}
}

func sendStreamChunk(sender backend.CallResourceResponseSender, chunk ChatResponse) error {
	body, err := json.Marshal(chunk)
	if err != nil {
		return fmt.Errorf("marshal chunk: %w", err)
	}
	body = append(body, '\n')

	return sender.Send(&backend.CallResourceResponse{
		Status: http.StatusOK,
		Headers: map[string][]string{
			"Content-Type": {"application/x-ndjson"},
		},
		Body: body,
	})
}
