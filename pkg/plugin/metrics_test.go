package plugin

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
)

func TestMetrics_RegistersWithoutPanic(t *testing.T) {
	t.Parallel()

	reg := prometheus.NewRegistry()
	m := newMetrics(reg)

	if m.requestsTotal == nil {
		t.Error("requestsTotal is nil")
	}
	if m.requestDuration == nil {
		t.Error("requestDuration is nil")
	}
	if m.tokensUsed == nil {
		t.Error("tokensUsed is nil")
	}
}

func TestMetrics_RecordRequest(t *testing.T) {
	t.Parallel()

	reg := prometheus.NewRegistry()
	m := newMetrics(reg)

	m.recordRequest("test-model", "success", 0.5, 100, 50)

	families, err := reg.Gather()
	if err != nil {
		t.Fatalf("gather metrics: %v", err)
	}

	if len(families) == 0 {
		t.Fatal("expected metrics to be gathered")
	}

	found := map[string]bool{}
	for _, f := range families {
		found[f.GetName()] = true
	}

	if !found["grafana_llm_requests_total"] {
		t.Error("missing grafana_llm_requests_total metric")
	}
	if !found["grafana_llm_request_duration_seconds"] {
		t.Error("missing grafana_llm_request_duration_seconds metric")
	}
	if !found["grafana_llm_tokens_used_total"] {
		t.Error("missing grafana_llm_tokens_used_total metric")
	}
}

func TestMetrics_RecordRequestMultipleTimes(t *testing.T) {
	t.Parallel()

	reg := prometheus.NewRegistry()
	m := newMetrics(reg)

	m.recordRequest("model-a", "success", 1.0, 50, 25)
	m.recordRequest("model-a", "error", 0.1, 0, 0)
	m.recordRequest("model-b", "success", 2.0, 200, 100)

	families, err := reg.Gather()
	if err != nil {
		t.Fatalf("gather metrics: %v", err)
	}

	if len(families) < 3 {
		t.Errorf("expected at least 3 metric families, got %d", len(families))
	}
}
