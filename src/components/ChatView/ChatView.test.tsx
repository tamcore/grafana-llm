jest.mock('@grafana/ui', () => ({
  useStyles2: (fn: any) =>
    fn({
      spacing: (n: number) => `${n * 8}px`,
      colors: {
        background: { secondary: '#f0f0f0', canvas: '#fff' },
        border: { weak: '#ccc', medium: '#aaa' },
        text: { secondary: '#666', primary: '#333' },
      },
      shape: { radius: { default: '4px' } },
      typography: {
        fontWeightBold: 700,
        fontWeightMedium: 500,
        bodySmall: { fontSize: '12px' },
        fontFamilyMonospace: 'monospace',
      },
    }),
  IconButton: ({ name, onClick, 'aria-label': ariaLabel }: any) => (
    <button data-testid={`icon-${name}`} onClick={onClick} aria-label={ariaLabel}>
      {name}
    </button>
  ),
}));

import { render, screen } from '@testing-library/react';
import { ChatView, ChatMessage } from './ChatView';

describe('ChatView', () => {
  it('renders the container', () => {
    render(<ChatView messages={[]} isStreaming={false} streamContent="" />);
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });

  it('renders user messages', () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];
    render(<ChatView messages={messages} isStreaming={false} streamContent="" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders assistant messages', () => {
    const messages: ChatMessage[] = [{ role: 'assistant', content: 'Hi there' }];
    render(<ChatView messages={messages} isStreaming={false} streamContent="" />);
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getByText('Assistant')).toBeInTheDocument();
  });

  it('shows streaming content with cursor', () => {
    render(<ChatView messages={[]} isStreaming={true} streamContent="Loading..." />);
    expect(screen.getByText(/Loading\.\.\./)).toBeInTheDocument();
    expect(screen.getByText('▌')).toBeInTheDocument();
  });

  it('hides streaming when not active', () => {
    render(<ChatView messages={[]} isStreaming={false} streamContent="" />);
    expect(screen.queryByText('▌')).not.toBeInTheDocument();
  });

  it('renders multiple messages in order', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'user', content: 'Third' },
    ];
    render(<ChatView messages={messages} isStreaming={false} streamContent="" />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('renders tool call badges with copy button', () => {
    const toolCalls = [
      { name: 'query_prometheus', arguments: '{"query":"rate(http_requests_total[5m])"}' },
    ];
    render(
      <ChatView messages={[]} isStreaming={true} streamContent="" activeToolCalls={toolCalls} />
    );
    expect(screen.getByTestId('tool-call')).toBeInTheDocument();
    expect(screen.getByText('📊 Querying Prometheus')).toBeInTheDocument();
    expect(screen.getByText('rate(http_requests_total[5m])')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy query')).toBeInTheDocument();
  });

  it('renders list_alerts tool call badge', () => {
    const toolCalls = [
      { name: 'list_alerts', arguments: '{"state":"firing","filter":"severity=critical"}' },
    ];
    render(
      <ChatView messages={[]} isStreaming={true} streamContent="" activeToolCalls={toolCalls} />
    );
    expect(screen.getByText('🚨 Checking alerts')).toBeInTheDocument();
    expect(screen.getByText('state=firing severity=critical')).toBeInTheDocument();
  });
});
