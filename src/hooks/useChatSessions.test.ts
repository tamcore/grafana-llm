jest.mock('@grafana/runtime', () => ({
  usePluginUserStorage: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import { usePluginUserStorage } from '@grafana/runtime';
import { useChatSessions } from './useChatSessions';
import { ChatSession } from '../utils/chatStorage';

const mockUsePluginUserStorage = usePluginUserStorage as jest.Mock;

function createMockStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => data[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data[key] = value;
    }),
    data,
  };
}

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'test-1',
    title: 'Test',
    mode: 'chat',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ],
    context: { autoDiscovery: true },
    contextTokens: 100,
    maxTokens: 120000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useChatSessions', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockUsePluginUserStorage.mockReturnValue(mockStorage);
  });

  it('loads empty index on mount', async () => {
    const { result } = renderHook(() => useChatSessions());

    // Wait for the useEffect to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('loads existing index on mount', async () => {
    const summaries = [
      { id: '1', title: 'S1', mode: 'chat', messageCount: 2, preview: 'hi', createdAt: '', updatedAt: '' },
    ];
    mockStorage.data['chat-sessions'] = JSON.stringify(summaries);

    const { result } = renderHook(() => useChatSessions());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].id).toBe('1');
  });

  it('saves a session and updates state', async () => {
    const { result } = renderHook(() => useChatSessions());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const session = makeSession();
    let index: typeof result.current.sessions = [];
    await act(async () => {
      index = await result.current.saveSession(session);
    });

    expect(index).toHaveLength(1);
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].id).toBe('test-1');
  });

  it('loads a full session', async () => {
    const { result } = renderHook(() => useChatSessions());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const session = makeSession();
    await act(async () => {
      await result.current.saveSession(session);
    });

    let loaded: ChatSession | null = null;
    await act(async () => {
      loaded = await result.current.loadSession('test-1');
    });

    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(2);
  });

  it('deletes a session and updates state', async () => {
    const { result } = renderHook(() => useChatSessions());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.saveSession(makeSession());
    });
    expect(result.current.sessions).toHaveLength(1);

    await act(async () => {
      await result.current.deleteSession('test-1');
    });
    expect(result.current.sessions).toHaveLength(0);
  });

  it('exports a session as JSON', async () => {
    const { result } = renderHook(() => useChatSessions());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.saveSession(makeSession());
    });

    let json: string | null = null;
    await act(async () => {
      json = await result.current.exportSession('test-1');
    });

    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.id).toBe('test-1');
  });

  it('imports a session from JSON', async () => {
    const { result } = renderHook(() => useChatSessions());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const session = makeSession();
    await act(async () => {
      await result.current.importSession(JSON.stringify(session));
    });

    expect(result.current.sessions).toHaveLength(1);
    // Imported session gets a new ID
    expect(result.current.sessions[0].id).not.toBe('test-1');
  });
});
