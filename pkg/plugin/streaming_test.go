package plugin

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestStreamingChat_SendsSSEChunks(t *testing.T) {
	t.Parallel()

	llmServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		var reqBody map[string]interface{}
		_ = json.Unmarshal(bodyBytes, &reqBody)

		if reqBody["stream"] != true {
			t.Error("expected stream=true in request")
		}

		w.Header().Set("Content-Type", "text/event-stream")
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatal("expected http.Flusher")
		}

		chunks := []string{
			`data: {"choices":[{"delta":{"content":"Hello"}}]}`,
			`data: {"choices":[{"delta":{"content":" world"}}]}`,
			`data: {"choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":5,"completion_tokens":3}}`,
			`data: [DONE]`,
		}

		for _, chunk := range chunks {
			_, _ = w.Write([]byte(chunk + "\n\n"))
			flusher.Flush()
		}
	}))
	defer llmServer.Close()

	app := newTestApp(t, llmServer.URL+"/v1", "key")

	chatReq := `{
		"mode": "explain_panel",
		"prompt": "test",
		"context": {"panel": {"title": "Test"}}
	}`

	req := &backend.CallResourceRequest{
		Path:   "chat/stream",
		Method: http.MethodPost,
		Body:   []byte(chatReq),
	}

	var responses []*backend.CallResourceResponse

	sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		cp := &backend.CallResourceResponse{
			Status:  res.Status,
			Headers: res.Headers,
			Body:    make([]byte, len(res.Body)),
		}
		copy(cp.Body, res.Body)
		responses = append(responses, cp)
		return nil
	})

	err := app.CallResource(context.Background(), req, sender)
	if err != nil {
		t.Fatalf("CallResource returned error: %v", err)
	}

	if len(responses) == 0 {
		t.Fatal("expected at least one response")
	}

	// Collect all content from streamed responses
	var fullContent strings.Builder
	for _, resp := range responses {
		var chunk ChatResponse
		if err := json.Unmarshal(resp.Body, &chunk); err != nil {
			continue
		}
		fullContent.WriteString(chunk.Content)
	}

	if got := fullContent.String(); got != "Hello world!" {
		t.Errorf("streamed content = %q, want %q", got, "Hello world!")
	}
}

func TestStreamingChat_MissingPrompt(t *testing.T) {
	t.Parallel()

	app := newTestApp(t, "http://localhost:1/v1", "key")

	req := &backend.CallResourceRequest{
		Path:   "chat/stream",
		Method: http.MethodPost,
		Body:   []byte(`{"mode":"explain_panel","context":{}}`),
	}

	var statusCode int

	sender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		statusCode = res.Status
		return nil
	})

	err := app.CallResource(context.Background(), req, sender)
	if err != nil {
		t.Fatalf("CallResource returned error: %v", err)
	}

	if statusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", statusCode, http.StatusBadRequest)
	}
}
