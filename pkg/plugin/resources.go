package plugin

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

// ChatRequest represents an incoming chat analysis request.
type ChatRequest struct {
	Mode    string          `json:"mode"`
	Prompt  string          `json:"prompt"`
	Context json.RawMessage `json:"context"`
}

// ChatResponse represents the chat completion response.
type ChatResponse struct {
	Content string `json:"content"`
	Usage   *Usage `json:"usage,omitempty"`
	Done    bool   `json:"done"`
}

// Usage holds token usage information.
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
}

var validModes = map[string]bool{
	"explain_panel":       true,
	"summarize_dashboard": true,
	"analyze_logs":        true,
	"analyze_metrics":     true,
}

func (a *App) registerRoutes() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", a.handleHealth)
	mux.HandleFunc("POST /chat", a.handleChat)
	mux.HandleFunc("/", a.handleNotFound)

	a.httpHandler = httpadapter.New(mux)
}

// CallResource routes requests, handling streaming endpoints directly.
func (a *App) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req.Path == "chat/stream" && req.Method == http.MethodPost {
		return a.handleStreamResource(ctx, req, sender)
	}
	return a.httpHandler.CallResource(ctx, req, sender)
}

func (a *App) handleStreamResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	var chatReq ChatRequest
	if err := json.Unmarshal(req.Body, &chatReq); err != nil {
		return sendErrorResponse(sender, http.StatusBadRequest, "invalid request body: "+err.Error())
	}

	if chatReq.Prompt == "" {
		return sendErrorResponse(sender, http.StatusBadRequest, "prompt is required")
	}

	if !validModes[chatReq.Mode] {
		return sendErrorResponse(sender, http.StatusBadRequest, "invalid mode: "+chatReq.Mode)
	}

	return a.streamChatCompletion(ctx, chatReq, sender)
}

func sendErrorResponse(sender backend.CallResourceResponseSender, status int, message string) error {
	body, _ := json.Marshal(map[string]string{"error": message})
	return sender.Send(&backend.CallResourceResponse{
		Status: status,
		Headers: map[string][]string{
			"Content-Type": {"application/json"},
		},
		Body: body,
	})
}

func (a *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	result, err := a.CheckHealth(r.Context(), &backend.CheckHealthRequest{})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"status":  "error",
			"message": err.Error(),
		})
		return
	}

	status := http.StatusOK
	statusStr := "ok"

	if result.Status != backend.HealthStatusOk {
		status = http.StatusBadGateway
		statusStr = "error"
	}

	writeJSON(w, status, map[string]string{
		"status":   statusStr,
		"message":  result.Message,
		"model":    a.settings.Model,
		"provider": a.settings.EndpointURL,
	})
}

func (a *App) handleChat(w http.ResponseWriter, r *http.Request) {
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body: " + err.Error(),
		})
		return
	}

	if req.Prompt == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "prompt is required",
		})
		return
	}

	if !validModes[req.Mode] {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid mode: " + req.Mode,
		})
		return
	}

	content, usage, err := a.chatCompletion(r.Context(), req)
	if err != nil {
		a.logger.Error("chat completion failed", "error", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "LLM request failed: " + err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, ChatResponse{
		Content: content,
		Usage:   usage,
		Done:    true,
	})
}

func (a *App) handleNotFound(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]string{
		"error": "not found",
	})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
