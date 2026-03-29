# Specification: Grafana LLM Analysis Plugin

**Plugin ID:** `tamcore-llmanalysis-app`
**Type:** App plugin with backend (`backend: true`, `streaming: true`)

## 1. Supported Providers

The plugin targets any **OpenAI-compatible** chat completion API. Compatibility
means the endpoint implements `POST /v1/chat/completions` with the standard
request/response schema.

### Tested Providers

| Provider              | Base URL Example                                      | Auth Method      |
| --------------------- | ----------------------------------------------------- | ---------------- |
| IONOS AI Model Hub    | `https://openai.inference.de-txl.ionos.com/v1`        | Bearer token     |
| OpenAI                | `https://api.openai.com/v1`                           | Bearer token     |
| Azure OpenAI          | `https://{resource}.openai.azure.com/openai/deployments/{deployment}` | API key header |
| Ollama                | `http://localhost:11434/v1`                            | None             |
| vLLM                  | `http://localhost:8000/v1`                             | Bearer token     |
| LiteLLM               | `http://localhost:4000/v1`                             | Bearer token     |

### Auth Configuration

- **API Key** — stored in Grafana `secureJsonData`, never exposed to frontend.
- **Custom Headers** — optional key-value pairs for provider-specific headers
  (e.g., Azure `api-key` header).

## 2. Analysis Modes

### 2.1 Explain Panel

- **Input:** Single panel's query results, panel metadata (title, description,
  field config, thresholds), active time range.
- **Output:** Narrative explanation of what the panel shows, notable patterns,
  and potential concerns.
- **Trigger:** Extension point on panel context menu ("Explain this panel").

### 2.2 Summarize Dashboard

- **Input:** Dashboard title, description, template variables, annotations,
  list of all panels with titles and sampled query results.
- **Output:** Dashboard-level summary: purpose, key metrics, current state,
  any anomalies across panels.
- **Trigger:** Plugin main page with dashboard selector.

### 2.3 Analyze Loki Logs

- **Input:** Selected log lines or LogQL query results, time range, labels.
- **Output:** Answer to user's question about the logs, patterns found,
  error categorization, root cause hints.
- **Trigger:** Plugin main page with log context.

### 2.4 Analyze Prometheus Metrics

- **Input:** PromQL query results or time-series data, metric names, labels,
  time range.
- **Output:** Answer to user's question about the metrics, trend analysis,
  anomaly detection hints, threshold recommendations.
- **Trigger:** Plugin main page with metric context.

## 3. API Contract

### 3.1 Plugin Configuration

Stored via Grafana's plugin settings API.

**`jsonData` (non-secret):**

```json
{
  "endpointURL": "https://openai.inference.de-txl.ionos.com/v1",
  "model": "gpt-oss120b",
  "timeoutSeconds": 60,
  "maxTokens": 4096,
  "customHeaders": {}
}
```

**`secureJsonData` (encrypted):**

```json
{
  "apiKey": "Bearer ey..."
}
```

### 3.2 Resource Endpoints

All endpoints are under `GET/POST /api/plugins/tamcore-llmanalysis-app/resources/`.

#### `GET /health`

Test the LLM connection.

**Response (200):**

```json
{
  "status": "ok",
  "model": "gpt-oss120b",
  "provider": "https://openai.inference.de-txl.ionos.com/v1"
}
```

**Response (502):**

```json
{
  "status": "error",
  "message": "connection refused"
}
```

#### `POST /chat`

Send a chat completion request with context. Supports streaming via
`Accept: text/event-stream`.

**Request:**

```json
{
  "mode": "explain_panel",
  "context": {
    "panel": {
      "title": "CPU Usage",
      "description": "CPU usage by host",
      "queries": ["avg(rate(node_cpu_seconds_total{mode!=\"idle\"}[5m]))"],
      "fields": ["time", "value"],
      "data": [[1711700000, 0.42], [1711700060, 0.45]],
      "timeRange": {
        "from": "2024-03-29T07:00:00Z",
        "to": "2024-03-29T08:00:00Z"
      }
    }
  },
  "prompt": "Why is CPU usage trending upward?"
}
```

**Response (streaming, SSE):**

```
data: {"content": "Based on the CPU usage data", "done": false}
data: {"content": " showing an upward trend from 42%", "done": false}
data: {"content": " to 45%...", "done": false}
data: {"content": "", "done": true, "usage": {"prompt_tokens": 150, "completion_tokens": 85}}
```

**Response (non-streaming, 200):**

```json
{
  "content": "Based on the CPU usage data showing an upward trend...",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 85
  }
}
```

### 3.3 Analysis Mode Context Schemas

#### Explain Panel Context

```json
{
  "panel": {
    "title": "string",
    "description": "string",
    "queries": ["string"],
    "fields": ["string"],
    "data": [["any"]],
    "thresholds": [{"value": 0, "color": "green"}, {"value": 80, "color": "red"}],
    "timeRange": {"from": "ISO8601", "to": "ISO8601"}
  }
}
```

#### Summarize Dashboard Context

```json
{
  "dashboard": {
    "title": "string",
    "description": "string",
    "tags": ["string"],
    "variables": [{"name": "string", "current": "string"}],
    "panels": [
      {
        "title": "string",
        "type": "string",
        "queries": ["string"],
        "fields": ["string"],
        "dataSample": [["any"]]
      }
    ],
    "timeRange": {"from": "ISO8601", "to": "ISO8601"}
  }
}
```

#### Analyze Logs Context

```json
{
  "logs": {
    "query": "string",
    "labels": {"key": "value"},
    "lines": [
      {"timestamp": "ISO8601", "line": "string", "labels": {"key": "value"}}
    ],
    "timeRange": {"from": "ISO8601", "to": "ISO8601"}
  }
}
```

#### Analyze Metrics Context

```json
{
  "metrics": {
    "query": "string",
    "labels": {"key": "value"},
    "series": [
      {"metric": {"key": "value"}, "values": [[1711700000, "0.42"]]}
    ],
    "timeRange": {"from": "ISO8601", "to": "ISO8601"}
  }
}
```
