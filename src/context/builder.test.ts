import {
  buildPanelContext,
  buildDashboardContext,
  buildLogsContext,
  buildMetricsContext,
  buildContext,
  estimateTokens,
  estimateContextTokens,
} from './builder';
import { PanelContext, DashboardContext, LogsContext, MetricsContext } from './types';

describe('estimateTokens', () => {
  it('estimates token count from string length', () => {
    const text = 'Hello, world!'; // 13 chars => ceil(13/4) = 4
    expect(estimateTokens(text)).toBe(4);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('buildPanelContext', () => {
  const panel: PanelContext = {
    title: 'CPU Usage',
    description: 'CPU by host',
    queries: ['avg(rate(cpu[5m]))'],
    fields: ['time', 'value'],
    data: Array.from({ length: 100 }, (_, i) => [i, Math.random()]),
    timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T01:00:00Z' },
  };

  it('truncates data to default 50 rows', () => {
    const ctx = buildPanelContext(panel);
    expect(ctx.panel?.data?.length).toBe(50);
  });

  it('truncates data to custom limit', () => {
    const ctx = buildPanelContext(panel, { maxDataRows: 10 });
    expect(ctx.panel?.data?.length).toBe(10);
  });

  it('preserves data when under limit', () => {
    const smallPanel: PanelContext = { title: 'Small', data: [[1, 2]] };
    const ctx = buildPanelContext(smallPanel);
    expect(ctx.panel?.data?.length).toBe(1);
  });

  it('preserves metadata', () => {
    const ctx = buildPanelContext(panel);
    expect(ctx.panel?.title).toBe('CPU Usage');
    expect(ctx.panel?.queries).toEqual(['avg(rate(cpu[5m]))']);
  });
});

describe('buildDashboardContext', () => {
  const dashboard: DashboardContext = {
    title: 'Overview',
    description: 'System overview',
    panels: [
      {
        title: 'Panel 1',
        type: 'graph',
        dataSample: Array.from({ length: 100 }, (_, i) => [i]),
      },
    ],
    timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T01:00:00Z' },
  };

  it('truncates panel data samples', () => {
    const ctx = buildDashboardContext(dashboard);
    expect(ctx.dashboard?.panels?.[0].dataSample?.length).toBe(50);
  });

  it('preserves dashboard metadata', () => {
    const ctx = buildDashboardContext(dashboard);
    expect(ctx.dashboard?.title).toBe('Overview');
  });
});

describe('buildLogsContext', () => {
  const logs: LogsContext = {
    query: '{app="test"}',
    lines: Array.from({ length: 100 }, (_, i) => ({
      timestamp: `2024-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      line: `log line ${i}`,
    })),
    timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T01:00:00Z' },
  };

  it('truncates log lines to default limit', () => {
    const ctx = buildLogsContext(logs);
    expect(ctx.logs?.lines.length).toBe(50);
  });

  it('preserves query', () => {
    const ctx = buildLogsContext(logs);
    expect(ctx.logs?.query).toBe('{app="test"}');
  });
});

describe('buildMetricsContext', () => {
  const metrics: MetricsContext = {
    query: 'up',
    series: [
      {
        metric: { instance: 'localhost' },
        values: Array.from({ length: 100 }, (_, i) => [i, '1'] as [number, string]),
      },
    ],
  };

  it('truncates series values', () => {
    const ctx = buildMetricsContext(metrics);
    expect(ctx.metrics?.series[0].values.length).toBe(50);
  });
});

describe('buildContext', () => {
  it('builds panel context for explain_panel mode', () => {
    const ctx = buildContext('explain_panel', { panel: { title: 'Test' } });
    expect(ctx.panel).toBeDefined();
    expect(ctx.panel?.title).toBe('Test');
  });

  it('builds dashboard context for summarize_dashboard mode', () => {
    const ctx = buildContext('summarize_dashboard', { dashboard: { title: 'Dash' } });
    expect(ctx.dashboard).toBeDefined();
  });

  it('builds logs context for analyze_logs mode', () => {
    const ctx = buildContext('analyze_logs', { logs: { lines: [] } });
    expect(ctx.logs).toBeDefined();
  });

  it('builds metrics context for analyze_metrics mode', () => {
    const ctx = buildContext('analyze_metrics', { metrics: { series: [] } });
    expect(ctx.metrics).toBeDefined();
  });

  it('returns empty context when data is missing', () => {
    const ctx = buildContext('explain_panel', {});
    expect(ctx).toEqual({});
  });
});

describe('estimateContextTokens', () => {
  it('returns positive number for non-empty context', () => {
    const tokens = estimateContextTokens({ panel: { title: 'Test', data: [[1, 2, 3]] } });
    expect(tokens).toBeGreaterThan(0);
  });

  it('returns small number for empty context', () => {
    const tokens = estimateContextTokens({});
    expect(tokens).toBeLessThan(5);
  });
});
