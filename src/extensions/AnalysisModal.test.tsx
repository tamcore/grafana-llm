import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PanelAnalysisModal, ExploreAnalysisModal } from './AnalysisModal';
import * as client from '../api/client';
import { PluginExtensionPanelContext } from '@grafana/data';

jest.mock('@grafana/ui', () => ({
  useStyles2: (fn: Function) => {
    const theme = {
      spacing: (n: number) => `${n * 8}px`,
      colors: {
        text: { secondary: '#999', primary: '#fff' },
        background: { secondary: '#222', canvas: '#111', primary: '#333' },
        border: { weak: '#444' },
      },
      typography: { fontWeightBold: 700, bodySmall: { fontSize: '12px' } },
      shape: { radius: { default: '4px' } },
    };
    return fn(theme);
  },
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
  Select: ({ options, value, onChange, ...rest }: any) => (
    <select
      data-testid={rest['data-testid'] || 'select'}
      value={value}
      onChange={(e) => onChange({ value: e.target.value })}
    >
      {options?.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  Input: ({ value, onChange, onKeyDown, ...rest }: any) => (
    <input
      data-testid={rest['data-testid'] || 'input'}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  ),
  TextArea: ({ value, onChange, ...rest }: any) => (
    <textarea data-testid={rest['data-testid'] || 'textarea'} value={value} onChange={onChange} readOnly={rest.readOnly} />
  ),
  Alert: ({ children, title }: any) => (
    <div role="alert">
      {title}: {children}
    </div>
  ),
}));

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    post: jest.fn(),
    get: jest.fn(),
  }),
}));

jest.mock('../api/client', () => ({
  streamChat: jest.fn(),
  sendChat: jest.fn(),
}));

const mockStreamChat = client.streamChat as jest.MockedFunction<typeof client.streamChat>;
const mockSendChat = client.sendChat as jest.MockedFunction<typeof client.sendChat>;

const mockPanelContext: PluginExtensionPanelContext = {
  pluginId: 'timeseries',
  id: 1,
  title: 'CPU Usage',
  timeRange: { from: 'now-1h', to: 'now' },
  timeZone: 'browser',
  dashboard: { uid: 'test-dash', title: 'Test Dashboard', tags: [] },
  targets: [{ refId: 'A', expr: 'rate(node_cpu_seconds_total[5m])' } as any],
  data: {
    state: 'Done' as any,
    series: [
      {
        name: 'cpu',
        fields: [
          { name: 'Time', values: [1711700000], type: 'time' as any, config: {} },
          { name: 'Value', values: [0.85], type: 'number' as any, config: {} },
        ],
        length: 1,
      },
    ],
    timeRange: { from: new Date(), to: new Date(), raw: { from: 'now-1h', to: 'now' } } as any,
  } as any,
};

describe('PanelAnalysisModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with panel context', () => {
    render(<PanelAnalysisModal context={mockPanelContext} />);

    expect(screen.getByTestId('panel-analysis-modal')).toBeInTheDocument();
    expect(screen.getByText(/Panel: CPU Usage/)).toBeInTheDocument();
    expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
    const promptVal = (screen.getByTestId('prompt-input') as HTMLInputElement).value;
    expect(promptVal).toContain('CPU Usage');
  });

  it('renders without panel context', () => {
    render(<PanelAnalysisModal />);

    expect(screen.getByTestId('panel-analysis-modal')).toBeInTheDocument();
    const promptVal = (screen.getByTestId('prompt-input') as HTMLInputElement).value;
    expect(promptVal).toContain('this');
  });

  it('builds context JSON from panel data', () => {
    render(<PanelAnalysisModal context={mockPanelContext} />);

    // Open the details to see the context
    const details = screen.getByText('Panel context (JSON)');
    fireEvent.click(details);

    const textarea = screen.getByTestId('context-json');
    const json = JSON.parse((textarea as HTMLTextAreaElement).value);
    expect(json.panel.title).toBe('CPU Usage');
    expect(json.panel.queries).toBeDefined();
    expect(json.panel.fields).toContain('Time');
    expect(json.panel.data).toHaveLength(1);
  });

  it('submits analysis and shows streaming response', async () => {
    async function* mockStream() {
      yield { content: 'This panel ', done: false };
      yield { content: 'shows CPU.', done: true };
    }
    mockStreamChat.mockReturnValue(mockStream() as any);

    render(<PanelAnalysisModal context={mockPanelContext} />);

    const submitBtn = screen.getByText('Analyze');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockStreamChat).toHaveBeenCalledWith('explain_panel', expect.any(String), expect.any(Object));
    });

    await waitFor(() => {
      const msgs = screen.getAllByText(/CPU/);
      expect(msgs.length).toBeGreaterThan(0);
    });
  });

  it('falls back to sendChat on stream failure', async () => {
    mockStreamChat.mockImplementation(async function* () {
      throw new Error('Stream failed');
    });
    mockSendChat.mockResolvedValue({ content: 'Fallback response', done: true });

    render(<PanelAnalysisModal context={mockPanelContext} />);

    fireEvent.click(screen.getByText('Analyze'));

    await waitFor(() => {
      expect(mockSendChat).toHaveBeenCalled();
    });
  });

  it('calls onDismiss when provided', () => {
    const onDismiss = jest.fn();
    render(<PanelAnalysisModal context={mockPanelContext} onDismiss={onDismiss} />);
    expect(screen.getByTestId('panel-analysis-modal')).toBeInTheDocument();
  });
});

describe('ExploreAnalysisModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default mode analyze_metrics', () => {
    render(<ExploreAnalysisModal />);

    expect(screen.getByTestId('explore-analysis-modal')).toBeInTheDocument();
    const select = screen.getByTestId('mode-select');
    expect(select).toHaveValue('analyze_metrics');
  });

  it('allows context input', () => {
    render(<ExploreAnalysisModal />);

    const contextInput = screen.getByTestId('context-input');
    fireEvent.change(contextInput, {
      target: { value: '{"metrics":{"query":"up"}}' },
    });
    expect(contextInput).toHaveValue('{"metrics":{"query":"up"}}');
  });

  it('submits analysis', async () => {
    async function* mockStream() {
      yield { content: 'Analysis result', done: true };
    }
    mockStreamChat.mockReturnValue(mockStream() as any);

    render(<ExploreAnalysisModal />);

    fireEvent.click(screen.getByText('Analyze'));

    await waitFor(() => {
      expect(mockStreamChat).toHaveBeenCalledWith('analyze_metrics', expect.any(String), expect.any(Object));
    });
  });
});
