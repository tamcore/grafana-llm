import {
  generateSessionId,
  generateTitle,
  toSummary,
  loadSessionIndex,
  loadSession,
  saveSession,
  deleteSession,
  exportSession,
  importSession,
  StorageBackend,
  ChatSession,
} from './chatStorage';

function createMockStorage(): StorageBackend & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: jest.fn(async (key: string) => data[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data[key] = value;
    }),
  };
}

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'test-1',
    title: 'Test Session',
    mode: 'chat',
    messages: [
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hi there' },
    ],
    context: { autoDiscovery: true },
    contextTokens: 500,
    maxTokens: 120000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('generateSessionId', () => {
  it('returns unique IDs', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toEqual(b);
  });

  it('returns a valid UUID', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('generateTitle', () => {
  it('returns "New Chat" for empty messages', () => {
    expect(generateTitle([])).toBe('New Chat');
  });

  it('returns "New Chat" when no user messages exist', () => {
    expect(generateTitle([{ role: 'assistant', content: 'Hello' }])).toBe('New Chat');
  });

  it('uses the first user message as title', () => {
    const messages = [
      { role: 'user' as const, content: 'What is Kubernetes?' },
      { role: 'assistant' as const, content: 'K8s is...' },
    ];
    expect(generateTitle(messages)).toBe('What is Kubernetes?');
  });

  it('truncates long messages to 60 chars', () => {
    const long = 'A'.repeat(100);
    const title = generateTitle([{ role: 'user', content: long }]);
    expect(title.length).toBe(60);
    expect(title).toMatch(/\.\.\.$/);
  });

  it('does not truncate messages at exactly 60 chars', () => {
    const exact = 'B'.repeat(60);
    expect(generateTitle([{ role: 'user', content: exact }])).toBe(exact);
  });
});

describe('toSummary', () => {
  it('builds a summary from a session', () => {
    const session = makeSession();
    const summary = toSummary(session);

    expect(summary.id).toBe('test-1');
    expect(summary.title).toBe('Test Session');
    expect(summary.mode).toBe('chat');
    expect(summary.messageCount).toBe(2);
    expect(summary.preview).toBe('Hello world');
    expect(summary.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('handles session with no user messages', () => {
    const session = makeSession({ messages: [{ role: 'assistant', content: 'Welcome' }] });
    const summary = toSummary(session);
    expect(summary.preview).toBe('');
    expect(summary.messageCount).toBe(1);
  });
});

describe('loadSessionIndex', () => {
  it('returns empty array when no index exists', async () => {
    const storage = createMockStorage();
    expect(await loadSessionIndex(storage)).toEqual([]);
  });

  it('returns parsed index', async () => {
    const storage = createMockStorage();
    const summaries = [{ id: '1', title: 'Test', mode: 'chat', messageCount: 1, preview: 'hi', createdAt: '', updatedAt: '' }];
    storage.data['chat-sessions'] = JSON.stringify(summaries);
    expect(await loadSessionIndex(storage)).toEqual(summaries);
  });

  it('returns empty array on corrupt data', async () => {
    const storage = createMockStorage();
    storage.data['chat-sessions'] = 'not json';
    expect(await loadSessionIndex(storage)).toEqual([]);
  });
});

describe('loadSession', () => {
  it('returns null when session does not exist', async () => {
    const storage = createMockStorage();
    expect(await loadSession(storage, 'nonexistent')).toBeNull();
  });

  it('returns parsed session', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    storage.data['chat-session-test-1'] = JSON.stringify(session);
    const loaded = await loadSession(storage, 'test-1');
    expect(loaded?.id).toBe('test-1');
    expect(loaded?.messages).toHaveLength(2);
  });
});

describe('saveSession', () => {
  it('saves session and creates index entry', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    const index = await saveSession(storage, session);

    expect(index).toHaveLength(1);
    expect(index[0].id).toBe('test-1');
    expect(storage.data['chat-session-test-1']).toBeDefined();
  });

  it('updates existing session in index', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    await saveSession(storage, session);

    const updated = { ...session, messages: [...session.messages, { role: 'user' as const, content: 'Follow up' }] };
    const index = await saveSession(storage, updated);

    expect(index).toHaveLength(1);
    expect(index[0].messageCount).toBe(3);
  });

  it('does not mutate the input session', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    const originalUpdatedAt = session.updatedAt;
    const originalMessages = [...session.messages];

    await saveSession(storage, session);

    expect(session.updatedAt).toBe(originalUpdatedAt);
    expect(session.messages).toEqual(originalMessages);
  });

  it('sorts by updatedAt descending', async () => {
    const storage = createMockStorage();
    const old = makeSession({ id: 'old', updatedAt: '2025-01-01T00:00:00.000Z' });
    const recent = makeSession({ id: 'recent', updatedAt: '2026-06-01T00:00:00.000Z' });

    await saveSession(storage, old);
    const index = await saveSession(storage, recent);

    expect(index[0].id).toBe('recent');
    expect(index[1].id).toBe('old');
  });

  it('trims to 50 sessions', async () => {
    const storage = createMockStorage();
    for (let i = 0; i < 55; i++) {
      const session = makeSession({ id: `s-${i}`, createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString() });
      await saveSession(storage, session);
    }
    const index = await loadSessionIndex(storage);
    expect(index.length).toBeLessThanOrEqual(50);
  });
});

describe('deleteSession', () => {
  it('removes session from index', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    await saveSession(storage, session);

    const index = await deleteSession(storage, 'test-1');
    expect(index).toHaveLength(0);
  });

  it('clears session data', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    await saveSession(storage, session);
    await deleteSession(storage, 'test-1');

    expect(storage.data['chat-session-test-1']).toBe('');
  });
});

describe('exportSession', () => {
  it('returns formatted JSON', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    await saveSession(storage, session);

    const json = await exportSession(storage, 'test-1');
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.id).toBe('test-1');
    expect(parsed.messages).toHaveLength(2);
  });

  it('returns null for missing session', async () => {
    const storage = createMockStorage();
    expect(await exportSession(storage, 'missing')).toBeNull();
  });
});

describe('importSession', () => {
  it('imports with a new ID', async () => {
    const storage = createMockStorage();
    const session = makeSession();
    const json = JSON.stringify(session);

    const index = await importSession(storage, json);
    expect(index).toHaveLength(1);
    expect(index[0].id).not.toBe('test-1'); // new ID assigned
    expect(index[0].title).toBe('Test Session');
  });

  it('throws on invalid JSON', async () => {
    const storage = createMockStorage();
    await expect(importSession(storage, 'not json')).rejects.toThrow();
  });
});
