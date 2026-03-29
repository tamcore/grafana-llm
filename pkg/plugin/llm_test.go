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

func TestBuildSystemPrompt_Chat(t *testing.T) {
	t.Parallel()

	prompt := buildSystemPrompt("chat", nil)

	if !contains(prompt, "operations assistant") {
		t.Error("expected chat prompt to mention 'operations assistant'")
	}
	if !contains(prompt, "list_datasources") {
		t.Error("expected chat prompt to mention 'list_datasources'")
	}
	if !contains(prompt, "list_dashboards") {
		t.Error("expected chat prompt to mention 'list_dashboards'")
	}
	if !contains(prompt, "query_prometheus") {
		t.Error("expected chat prompt to mention 'query_prometheus'")
	}
}

func TestBuildSystemPrompt_ChatWithContext(t *testing.T) {
	t.Parallel()

	ctx := json.RawMessage(`{"autoDiscovery":true,"datasources":[{"name":"Prometheus","type":"prometheus","uid":"prom-1"}]}`)
	prompt := buildSystemPrompt("chat", ctx)

	if !contains(prompt, "operations assistant") {
		t.Error("expected chat prompt base text")
	}
	if !contains(prompt, "Prometheus") {
		t.Error("expected prompt to include context with datasource info")
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
