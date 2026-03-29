import { useState, useCallback, useRef, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PluginExtensionPanelContext } from '@grafana/data';
import { useStyles2, Button, Select, Input, TextArea, Alert } from '@grafana/ui';
import { ChatView, ChatMessage } from '../components/ChatView/ChatView';
import { streamChat, sendChat } from '../api/client';
import { AnalysisMode, AnalysisContext } from '../context/types';

interface PanelAnalysisModalProps {
  context?: PluginExtensionPanelContext;
  onDismiss?: () => void;
}

const MODE_OPTIONS = [
  { label: 'Explain Panel', value: 'explain_panel' as AnalysisMode },
  { label: 'Analyze Metrics', value: 'analyze_metrics' as AnalysisMode },
];

function buildContextFromPanel(ctx?: PluginExtensionPanelContext): string {
  if (!ctx) {
    return '{}';
  }

  const panel: Record<string, unknown> = {
    title: ctx.title,
  };

  if (ctx.targets && ctx.targets.length > 0) {
    panel.queries = ctx.targets.map((t) => {
      const q = t as unknown as Record<string, unknown>;
      return q.expr || q.query || q.rawSql || q.refId || '';
    });
  }

  if (ctx.data?.series && ctx.data.series.length > 0) {
    const fields: string[] = [];
    const rows: unknown[][] = [];
    const maxRows = 30;

    for (const frame of ctx.data.series) {
      for (const field of frame.fields) {
        fields.push(field.name);
      }
      const rowCount = Math.min(frame.length, maxRows);
      for (let i = 0; i < rowCount; i++) {
        const row: unknown[] = [];
        for (const field of frame.fields) {
          row.push(field.values[i]);
        }
        rows.push(row);
      }
    }
    panel.fields = fields;
    panel.data = rows;
  }

  if (ctx.timeRange) {
    panel.timeRange = {
      from: ctx.timeRange.from,
      to: ctx.timeRange.to,
    };
  }

  const context: AnalysisContext = { panel: panel as unknown as AnalysisContext['panel'] };
  return JSON.stringify(context, null, 2);
}

export function PanelAnalysisModal({ context: panelCtx, onDismiss }: PanelAnalysisModalProps) {
  const styles = useStyles2(getStyles);

  const [mode, setMode] = useState<AnalysisMode>('explain_panel');
  const [prompt, setPrompt] = useState(`What does the "${panelCtx?.title || 'this'}" panel show? Are there any concerns?`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef(false);

  const contextJson = buildContextFromPanel(panelCtx);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isStreaming) {
      return;
    }

    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setIsStreaming(true);
    setStreamContent('');
    abortRef.current = false;

    try {
      let fullContent = '';
      const stream = streamChat(mode, prompt, JSON.parse(contextJson));

      for await (const chunk of stream) {
        if (abortRef.current) {
          break;
        }
        fullContent += chunk.content;
        setStreamContent(fullContent);
        if (chunk.done) {
          break;
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }]);
    } catch {
      try {
        const response = await sendChat(mode, prompt, JSON.parse(contextJson));
        setMessages((prev) => [...prev, { role: 'assistant', content: response.content }]);
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Analysis failed');
      }
    } finally {
      setIsStreaming(false);
      setStreamContent('');
      setPrompt('');
    }
  }, [prompt, mode, contextJson, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return (
    <div data-testid="panel-analysis-modal" className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <Select
            data-testid="mode-select"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(v) => setMode(v.value!)}
            width={20}
          />
          {panelCtx?.title && <span className={styles.panelTitle}>Panel: {panelCtx.title}</span>}
        </div>
      </div>

      <div className={styles.promptRow}>
        <Input
          data-testid="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          placeholder="Ask about this panel…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button onClick={handleSubmit} disabled={isStreaming || !prompt.trim()} icon={isStreaming ? 'fa fa-spinner' : 'play'}>
          {isStreaming ? 'Analyzing…' : 'Analyze'}
        </Button>
      </div>

      {error && <Alert severity="error" title="Error">{error}</Alert>}

      <div className={styles.chatArea}>
        <ChatView messages={messages} isStreaming={isStreaming} streamContent={streamContent} />
      </div>

      <details className={styles.contextDetails}>
        <summary>Panel context (JSON)</summary>
        <TextArea data-testid="context-json" value={contextJson} rows={6} readOnly />
      </details>
    </div>
  );
}

interface ExploreAnalysisModalProps {
  onDismiss?: () => void;
}

export function ExploreAnalysisModal({ onDismiss }: ExploreAnalysisModalProps) {
  const styles = useStyles2(getStyles);

  const [mode, setMode] = useState<AnalysisMode>('analyze_metrics');
  const [contextJson, setContextJson] = useState('{}');
  const [prompt, setPrompt] = useState('Analyze the current query results. Are there any anomalies or concerns?');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef(false);

  const modeOptions = [
    { label: 'Analyze Metrics', value: 'analyze_metrics' as AnalysisMode },
    { label: 'Analyze Logs', value: 'analyze_logs' as AnalysisMode },
    { label: 'Explain Panel', value: 'explain_panel' as AnalysisMode },
  ];

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isStreaming) {
      return;
    }

    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setIsStreaming(true);
    setStreamContent('');
    abortRef.current = false;

    try {
      let fullContent = '';
      let ctx: AnalysisContext;
      try {
        ctx = JSON.parse(contextJson);
      } catch {
        ctx = {};
      }
      const stream = streamChat(mode, prompt, ctx);

      for await (const chunk of stream) {
        if (abortRef.current) {
          break;
        }
        fullContent += chunk.content;
        setStreamContent(fullContent);
        if (chunk.done) {
          break;
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }]);
    } catch {
      try {
        const ctx = JSON.parse(contextJson) as AnalysisContext;
        const response = await sendChat(mode, prompt, ctx);
        setMessages((prev) => [...prev, { role: 'assistant', content: response.content }]);
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Analysis failed');
      }
    } finally {
      setIsStreaming(false);
      setStreamContent('');
    }
  }, [prompt, mode, contextJson, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return (
    <div data-testid="explore-analysis-modal" className={styles.container}>
      <div className={styles.header}>
        <Select
          data-testid="mode-select"
          options={modeOptions}
          value={mode}
          onChange={(v) => setMode(v.value!)}
          width={20}
        />
      </div>

      <TextArea
        data-testid="context-input"
        value={contextJson}
        onChange={(e) => setContextJson(e.currentTarget.value)}
        rows={4}
        placeholder="Paste query context JSON here…"
      />

      <div className={styles.promptRow}>
        <Input
          data-testid="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          placeholder="Ask about the results…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button onClick={handleSubmit} disabled={isStreaming || !prompt.trim()} icon={isStreaming ? 'fa fa-spinner' : 'play'}>
          {isStreaming ? 'Analyzing…' : 'Analyze'}
        </Button>
      </div>

      {error && <Alert severity="error" title="Error">{error}</Alert>}

      <div className={styles.chatArea}>
        <ChatView messages={messages} isStreaming={isStreaming} streamContent={streamContent} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1),
      minHeight: '300px',
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    headerRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      width: '100%',
    }),
    panelTitle: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontStyle: 'italic',
    }),
    promptRow: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
    }),
    chatArea: css({
      flex: 1,
      minHeight: '200px',
      maxHeight: '400px',
      overflowY: 'auto',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    contextDetails: css({
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      '& summary': {
        marginBottom: theme.spacing(0.5),
      },
    }),
  };
}
