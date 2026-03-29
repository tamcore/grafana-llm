// Mock Grafana modules to avoid ESM transformation issues
jest.mock('@grafana/ui', () => ({
  Field: ({ children, label }: any) => <div><label>{label}</label>{children}</div>,
  FieldSet: ({ children, label }: any) => <fieldset><legend>{label}</legend>{children}</fieldset>,
  Input: (props: any) => <input aria-label={props['aria-label']} value={props.value} onChange={props.onChange} />,
  SecretInput: (props: any) => <input aria-label={props['aria-label']} type="password" value={props.value} onChange={props.onChange} />,
  Button: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}));

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    post: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({ status: 'ok', message: 'Connected' }),
  }),
}));

import { render, screen } from '@testing-library/react';
import { AppConfig } from './AppConfig';

const mockPlugin = {
  meta: {
    id: 'tamcore-llmanalysis-app',
    name: 'LLM Analysis',
    type: 'app' as const,
    module: '',
    baseUrl: '',
    info: {
      author: { name: 'tamcore' },
      description: '',
      logos: { small: '', large: '' },
      links: [],
      screenshots: [],
      updated: '',
      version: '',
    },
    jsonData: {
      endpointURL: 'https://example.com/v1',
      model: 'test-model',
      timeoutSeconds: 60,
      maxTokens: 4096,
    },
    secureJsonFields: {},
    enabled: true,
  },
} as any;

describe('AppConfig', () => {
  it('renders the configuration form', () => {
    render(<AppConfig plugin={mockPlugin} query={{} as any} />);
    expect(screen.getByTestId('app-config')).toBeInTheDocument();
  });

  it('renders endpoint URL input', () => {
    render(<AppConfig plugin={mockPlugin} query={{} as any} />);
    expect(screen.getByLabelText(/endpoint url/i)).toBeInTheDocument();
  });

  it('renders model input', () => {
    render(<AppConfig plugin={mockPlugin} query={{} as any} />);
    expect(screen.getByLabelText(/^model$/i)).toBeInTheDocument();
  });

  it('renders API key input', () => {
    render(<AppConfig plugin={mockPlugin} query={{} as any} />);
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
  });

  it('renders save button', () => {
    render(<AppConfig plugin={mockPlugin} query={{} as any} />);
    expect(screen.getByText(/save settings/i)).toBeInTheDocument();
  });

  it('renders test connection button', () => {
    render(<AppConfig plugin={mockPlugin} query={{} as any} />);
    expect(screen.getByText(/test connection/i)).toBeInTheDocument();
  });

  it('displays existing endpoint URL from jsonData', () => {
    render(<AppConfig plugin={mockPlugin} query={{} as any} />);
    const input = screen.getByLabelText(/endpoint url/i) as HTMLInputElement;
    expect(input.value).toBe('https://example.com/v1');
  });
});
