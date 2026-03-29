import { AnalysisContext, PanelContext, DashboardContext, LogsContext, MetricsContext, AnalysisMode } from './types';

const DEFAULT_MAX_DATA_ROWS = 50;
const APPROX_CHARS_PER_TOKEN = 4;

export interface ContextBuilderOptions {
  maxDataRows?: number;
  maxTokenBudget?: number;
}

/**
 * Estimates token count from a string using a rough character-based heuristic.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

/**
 * Truncates data arrays to stay within the configured row limit.
 */
function truncateData<T>(data: T[] | undefined, maxRows: number): T[] | undefined {
  if (!data || data.length <= maxRows) {
    return data;
  }
  return data.slice(0, maxRows);
}

/**
 * Builds an AnalysisContext for an explain_panel request.
 */
export function buildPanelContext(panel: PanelContext, options?: ContextBuilderOptions): AnalysisContext {
  const maxRows = options?.maxDataRows ?? DEFAULT_MAX_DATA_ROWS;
  return {
    panel: {
      ...panel,
      data: truncateData(panel.data, maxRows),
    },
  };
}

/**
 * Builds an AnalysisContext for a summarize_dashboard request.
 */
export function buildDashboardContext(dashboard: DashboardContext, options?: ContextBuilderOptions): AnalysisContext {
  const maxRows = options?.maxDataRows ?? DEFAULT_MAX_DATA_ROWS;
  return {
    dashboard: {
      ...dashboard,
      panels: dashboard.panels?.map((p) => ({
        ...p,
        dataSample: truncateData(p.dataSample, maxRows),
      })),
    },
  };
}

/**
 * Builds an AnalysisContext for an analyze_logs request.
 */
export function buildLogsContext(logs: LogsContext, options?: ContextBuilderOptions): AnalysisContext {
  const maxRows = options?.maxDataRows ?? DEFAULT_MAX_DATA_ROWS;
  return {
    logs: {
      ...logs,
      lines: logs.lines.slice(0, maxRows),
    },
  };
}

/**
 * Builds an AnalysisContext for an analyze_metrics request.
 */
export function buildMetricsContext(metrics: MetricsContext, options?: ContextBuilderOptions): AnalysisContext {
  const maxRows = options?.maxDataRows ?? DEFAULT_MAX_DATA_ROWS;
  return {
    metrics: {
      ...metrics,
      series: metrics.series.map((s) => ({
        ...s,
        values: s.values.slice(0, maxRows),
      })),
    },
  };
}

/**
 * Builds the appropriate context based on analysis mode.
 */
export function buildContext(
  mode: AnalysisMode,
  data: { panel?: PanelContext; dashboard?: DashboardContext; logs?: LogsContext; metrics?: MetricsContext },
  options?: ContextBuilderOptions
): AnalysisContext {
  switch (mode) {
    case 'explain_panel':
      return data.panel ? buildPanelContext(data.panel, options) : {};
    case 'summarize_dashboard':
      return data.dashboard ? buildDashboardContext(data.dashboard, options) : {};
    case 'analyze_logs':
      return data.logs ? buildLogsContext(data.logs, options) : {};
    case 'analyze_metrics':
      return data.metrics ? buildMetricsContext(data.metrics, options) : {};
    default:
      return {};
  }
}

/**
 * Estimates the total token count of a serialized context.
 */
export function estimateContextTokens(context: AnalysisContext): number {
  return estimateTokens(JSON.stringify(context));
}
