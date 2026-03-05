import { beforeEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after stubbing fetch
const { listApps, getMe, createApp } = await import('./client');

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

describe('API client', () => {
  it('adds Authorization header when token is present', async () => {
    localStorage.setItem('token', 'test-jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', github_login: 'dev', display_name: 'Dev', avatar_url: null, role: 'developer' }),
    });

    await getMe();

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers?.['Authorization']).toBe('Bearer test-jwt');
  });

  it('does not add Authorization header without token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await listApps();

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers?.['Authorization']).toBeUndefined();
  });

  it('builds correct URL with search params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await listApps('firefox', 10, 20);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/apps?');
    expect(url).toContain('q=firefox');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });

  it('throws on non-ok response with error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad app-id format' }),
    });

    await expect(createApp({
      app_id: 'bad',
      name: 'Test',
      summary: 'Test app',
    })).rejects.toThrow('Bad app-id format');
  });

  it('throws with status text when error body is unparseable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => { throw new Error('not json'); },
    });

    await expect(getMe()).rejects.toThrow('Internal Server Error');
  });

  it('sends JSON body for POST requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', app_id: 'org.test.App' }),
    });

    await createApp({
      app_id: 'org.test.App',
      name: 'Test App',
      summary: 'A test',
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body);
    expect(body.app_id).toBe('org.test.App');
  });
});
