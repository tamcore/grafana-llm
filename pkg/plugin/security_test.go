package plugin

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSanitizePrompt_RemovesControlChars(t *testing.T) {
	t.Parallel()

	input := "Hello\x00World\x01\x02"
	got := sanitizePrompt(input)

	if got != "HelloWorld" {
		t.Errorf("sanitizePrompt(%q) = %q, want %q", input, got, "HelloWorld")
	}
}

func TestSanitizePrompt_PreservesNormalText(t *testing.T) {
	t.Parallel()

	input := "What is the CPU usage trend?"
	got := sanitizePrompt(input)

	if got != input {
		t.Errorf("sanitizePrompt(%q) = %q, want unchanged", input, got)
	}
}

func TestSanitizePrompt_TruncatesLongInput(t *testing.T) {
	t.Parallel()

	long := make([]byte, maxPromptLength+100)
	for i := range long {
		long[i] = 'a'
	}

	got := sanitizePrompt(string(long))
	if len(got) != maxPromptLength {
		t.Errorf("len(sanitizePrompt) = %d, want %d", len(got), maxPromptLength)
	}
}

func TestSanitizePrompt_PreservesNewlines(t *testing.T) {
	t.Parallel()

	input := "Line 1\nLine 2\nLine 3"
	got := sanitizePrompt(input)

	if got != input {
		t.Errorf("sanitizePrompt(%q) = %q, want unchanged", input, got)
	}
}

func TestSanitizePrompt_PreservesTabs(t *testing.T) {
	t.Parallel()

	input := "col1\tcol2\tcol3"
	got := sanitizePrompt(input)

	if got != input {
		t.Errorf("sanitizePrompt(%q) = %q, want unchanged", input, got)
	}
}

func TestSanitizeContextSize_UnderLimit(t *testing.T) {
	t.Parallel()

	small := []byte(`{"panel":{"title":"test"}}`)
	got, err := sanitizeContextSize(small, maxContextBytes)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if string(got) != string(small) {
		t.Error("expected unchanged context")
	}
}

func TestSanitizeContextSize_OverLimit(t *testing.T) {
	t.Parallel()

	big := make([]byte, maxContextBytes+1)
	for i := range big {
		big[i] = 'x'
	}

	_, err := sanitizeContextSize(big, maxContextBytes)
	if err == nil {
		t.Error("expected error for oversized context")
	}
}

func TestSettingsAPIKeyNeverInJSON(t *testing.T) {
	t.Parallel()

	s := Settings{
		EndpointURL:    "https://example.com/v1",
		Model:          "test",
		TimeoutSeconds: 60,
		MaxTokens:      100,
		APIKey:         "super-secret-key",
	}

	// The APIKey field has json:"-" tag, so it should never appear in JSON output
	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	if strings.Contains(string(data), "super-secret-key") {
		t.Error("API key appeared in JSON output — json:\"-\" tag is not working")
	}

	if strings.Contains(string(data), "apiKey") {
		t.Error("apiKey field appeared in JSON output")
	}
}
