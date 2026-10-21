import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL, API_TIMEOUT_MS } from '../../api/config';

let session: typeof import('./session');
let axios: typeof import('axios').default;
let setupAxios: typeof import('../../api/axios').setupAxios;
let dispose: (() => void) | undefined;
let storage: Storage;

beforeEach(async () => {
  vi.resetModules();
  const values = new Map<string, string>();
  storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
    clear: vi.fn(() => values.clear()),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('__DEV__', false);
  session = await import('./session');
  axios = (await import('axios')).default;
  ({ setupAxios } = await import('../../api/axios'));
  dispose = setupAxios();
});

afterEach(() => {
  dispose?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('token session', () => {
  it('starts without browser access and restores the saved token on the client', async () => {
    vi.stubGlobal('window', undefined);
    expect(session.getServerSession()).toMatchObject({ ready: false, token: null });
    vi.stubGlobal('window', { localStorage: storage });
    vi.mocked(storage.getItem).mockReturnValue('  test-token  ');
    session.restoreSession();
    expect(session.getSession()).toMatchObject({ ready: true, token: 'test-token' });
  });

  it('does not replace an active session when storage refuses the new token', () => {
    session.saveToken('test-original');
    const previous = session.getSession();
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error('Quota exceeded'); });
    expect(() => session.saveToken('test-replacement')).toThrow('Could not save');
    expect(session.getSession()).toBe(previous);
    expect(previous.signal?.aborted).toBe(false);
  });

  it('rejects an empty token without writing to storage', () => {
    expect(() => session.saveToken('   ')).toThrow('Enter an API token');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('shows a recoverable storage error instead of staying in loading', () => {
    vi.mocked(storage.getItem).mockImplementation(() => { throw new Error('Storage blocked'); });
    session.restoreSession();
    expect(session.getSession()).toMatchObject({ ready: true, token: null });
    expect(session.getSession().notice).toContain('Could not read');
    session.saveToken('test-recovered');
    expect(session.getSession().notice).toBeNull();
  });

  it('ignores expiration from a previous session', () => {
    session.saveToken('test-original');
    const previous = session.getSession();
    session.saveToken('test-replacement');
    session.expireSession(previous.version);
    expect(session.getSession().token).toBe('test-replacement');
    expect(previous.signal?.aborted).toBe(true);
  });

  it('removes the persisted token and aborts requests on sign out', () => {
    session.saveToken('test-token');
    const signal = session.getSession().signal;
    session.signOut();
    expect(storage.length).toBe(0);
    expect(signal?.aborted).toBe(true);
    expect(session.getSession().token).toBeNull();
  });
});

describe('global Axios interceptors', () => {
  it('prevents API requests before a token is available', async () => {
    session.restoreSession();
    const adapter = vi.fn();
    await expect(axios.get('/test', { adapter })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(adapter).not.toHaveBeenCalled();
  });

  it('uses the active token and configured defaults without creating another client', async () => {
    session.saveToken('test-original');
    const adapter = vi.fn(async (config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));
    await axios.get('/test', { adapter });
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer test-original');
    expect(adapter.mock.calls[0][0].baseURL).toBe(API_BASE_URL);
    expect(adapter.mock.calls[0][0].timeout).toBe(API_TIMEOUT_MS);
    session.saveToken('test-replacement');
    await axios.get('/test', { adapter });
    expect(adapter.mock.calls[1][0].headers.get('Authorization')).toBe('Bearer test-replacement');
  });

  it('does not attach the token to another origin', async () => {
    session.saveToken('test-token');
    const response = await axios.get('https://other.example/test', {
      adapter: async (config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }),
    });
    expect(response.config.headers.has('Authorization')).toBe(false);
  });

  it('expires the current session on 401 and preserves the rejected error', async () => {
    session.saveToken('test-token');
    let failure: unknown;
    await expect(axios.get('/test', {
      adapter: async (config) => {
        const response = { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config };
        failure = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response);
        throw failure;
      },
    })).rejects.toBe(failure);
    expect(session.getSession().token).toBeNull();
    expect(session.getSession().notice).toContain('rejected or has expired');
  });

  it('cancels an in-flight request when its session is replaced', async () => {
    session.saveToken('test-original');
    let finish: (() => void) | undefined;
    const request = axios.get('/test', {
      adapter: (config) => new Promise((resolve) => {
        finish = () => resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      }),
    });
    session.saveToken('test-replacement');
    finish?.();
    await expect(request).rejects.toSatisfy(axios.isCancel);
    expect(session.getSession().token).toBe('test-replacement');
  });

  it.each(['caller', 'session'])('cancels through the %s signal when both signals are present', async (source) => {
    session.saveToken('test-token');
    const controller = new AbortController();
    let finish: (() => void) | undefined;
    const request = axios.get('/test', {
      signal: controller.signal,
      adapter: (config) => new Promise((resolve) => {
        finish = () => resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      }),
    });
    if (source === 'caller') controller.abort();
    else session.saveToken('test-replacement');
    finish?.();
    await expect(request).rejects.toSatisfy(axios.isCancel);
    expect(session.getSession().token).toBe(source === 'caller' ? 'test-token' : 'test-replacement');
  });

  it('does not duplicate dev logs after cleanup and setup', async () => {
    session.saveToken('test-token');
    vi.stubGlobal('__DEV__', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    dispose?.();
    dispose = setupAxios();
    await axios.get('/test', {
      adapter: async (config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }),
    });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('does not log responses in production', async () => {
    session.saveToken('test-token');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await axios.get('/test', {
      adapter: async (config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }),
    });
    expect(log).not.toHaveBeenCalled();
  });
});
