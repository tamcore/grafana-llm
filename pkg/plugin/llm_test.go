package plugin

import (
	"encoding/json"
	"testing"
)

func TestBuildSystemPrompt_ExplainPanel(t *testing.T) {
	t.Parallel()

	ctx := json.RawMessage(`{"panel":{"title":"CPU Usage"}}`)
	prompt := buildSystemPrompt("explain_panel", ctx)

	if prompt == "" {
		t.Fatal("expected non-empty prompt")
	}

	if !contains(prompt, "panel analysis") {
		t.Error("expected prompt to mention 'panel analysis'")
	}

	if !contains(prompt, "CPU Usage") {
		t.Error("expected prompt to contain context data")
	}
}

func TestBuildSystemPrompt_SummarizeDashboard(t *testing.T) {
	t.Parallel()

	ctx := json.RawMessage(`{"dashboard":{"title":"Overview"}}`)
	prompt := buildSystemPrompt("summarize_dashboard", ctx)

	if !contains(prompt, "dashboard analysis") {
		t.Error("expected prompt to mention 'dashboard analysis'")
	}
}

func TestBuildSystemPrompt_AnalyzeLogs(t *testing.T) {
	t.Parallel()

	ctx := json.RawMessage(`{"logs":{"query":"{app=\"test\"}"}}`)
	prompt := buildSystemPrompt("analyze_logs", ctx)

	if !contains(prompt, "log analysis") {
		t.Error("expected prompt to mention 'log analysis'")
	}
}

func TestBuildSystemPrompt_AnalyzeMetrics(t *testing.T) {
	t.Parallel()

	ctx := json.RawMessage(`{"metrics":{"query":"up"}}`)
	prompt := buildSystemPrompt("analyze_metrics", ctx)

	if !contains(prompt, "metrics analysis") {
		t.Error("expected prompt to mention 'metrics analysis'")
	}
}

func TestBuildSystemPrompt_UnknownMode(t *testing.T) {
	t.Parallel()

	prompt := buildSystemPrompt("unknown", nil)

	if prompt == "" {
		t.Fatal("expected non-empty fallback prompt")
	}
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && (s != "" && substr != "" && containsLower(s, substr))
}

func containsLower(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if matchAt(s, substr, i) {
			return true
		}
	}
	return false
}

func matchAt(s, substr string, pos int) bool {
	for j := range len(substr) {
		sc := s[pos+j]
		pc := substr[j]
		if sc >= 'A' && sc <= 'Z' {
			sc += 32
		}
		if pc >= 'A' && pc <= 'Z' {
			pc += 32
		}
		if sc != pc {
			return false
		}
	}
	return true
}
