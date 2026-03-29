/** Analysis mode types matching the backend API contract. */
export type AnalysisMode = 'explain_panel' | 'summarize_dashboard' | 'analyze_logs' | 'analyze_metrics';

export interface TimeRange {
  from: string;
  to: string;
}

export interface PanelContext {
  title: string;
  description?: string;
  queries?: string[];
  fields?: string[];
  data?: unknown[][];
  thresholds?: Array<{ value: number; color: string }>;
  timeRange?: TimeRange;
}

export interface DashboardPanelSummary {
  title: string;
  type: string;
  queries?: string[];
  fields?: string[];
  dataSample?: unknown[][];
}

export interface DashboardContext {
  title: string;
  description?: string;
  tags?: string[];
  variables?: Array<{ name: string; current: string }>;
  panels?: DashboardPanelSummary[];
  timeRange?: TimeRange;
}

export interface LogLine {
  timestamp: string;
  line: string;
  labels?: Record<string, string>;
}

export interface LogsContext {
  query?: string;
  labels?: Record<string, string>;
  lines: LogLine[];
  timeRange?: TimeRange;
}

export interface MetricSeries {
  metric: Record<string, string>;
  values: Array<[number, string]>;
}

export interface MetricsContext {
  query?: string;
  labels?: Record<string, string>;
  series: MetricSeries[];
  timeRange?: TimeRange;
}

export interface AnalysisContext {
  panel?: PanelContext;
  dashboard?: DashboardContext;
  logs?: LogsContext;
  metrics?: MetricsContext;
}

export interface ChatRequest {
  mode: AnalysisMode;
  prompt: string;
  context: AnalysisContext;
}

export interface ChatResponse {
  content: string;
  done: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}
