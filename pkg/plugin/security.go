package plugin

import (
	"fmt"
	"strings"
	"unicode"
)

const (
	maxPromptLength = 10000
	maxContextBytes = 512 * 1024 // 512 KB
)

// sanitizePrompt removes control characters and truncates to the maximum length.
func sanitizePrompt(s string) string {
	var b strings.Builder
	b.Grow(len(s))

	for _, r := range s {
		if r == '\n' || r == '\r' || r == '\t' || !unicode.IsControl(r) {
			b.WriteRune(r)
		}
	}

	result := b.String()
	if len(result) > maxPromptLength {
		result = result[:maxPromptLength]
	}

	return result
}

// sanitizeContextSize rejects context payloads that exceed the maximum size.
func sanitizeContextSize(data []byte, maxBytes int) ([]byte, error) {
	if len(data) > maxBytes {
		return nil, fmt.Errorf("context too large: %d bytes exceeds maximum %d bytes", len(data), maxBytes)
	}
	return data, nil
}
