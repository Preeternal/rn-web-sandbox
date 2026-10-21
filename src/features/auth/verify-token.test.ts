import axios, { AxiosError, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupAxios } from '../../api/axios';
import { balancesQueryOptions } from '../../hooks/api/query-options';
import type { TBalancesResponse } from '../../types/features/balances';

import { getSession, saveToken, signOut } from './session';
import { createSessionQueryClient } from './session-query-client';
import { verifyAndSaveToken } from './verify-token';

const snapshot: TBalancesResponse = { asOf: '2026-10-21T08:00:00.000Z', items: [] };
const originalAdapter = axios.defaults.adapter;
let adapter = vi.fn<AxiosAdapter>();
let dispose: () => void;
let values: Map<string, string>;
let setItem = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('__DEV__', false);
  values = new Map();
  setItem = vi.fn((key: string, value: string) => { values.set(key, value); });
  vi.stubGlobal('window', { localStorage: {
    setItem, getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => values.delete(key),
  } });
  signOut();
  dispose = setupAxios();
  adapter = vi.fn<AxiosAdapter>();
  axios.defaults.adapter = adapter;
});

afterEach(() => {
  signOut();
  dispose();
  axios.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function respond(data: unknown = snapshot): AxiosAdapter {
  return async (config) => ({ data, status: 200, statusText: 'OK', headers: {}, config });
}

describe('token verification before persistence', () => {
  it('validates the candidate while signed out and saves only after a valid response', async () => {
    let finish!: () => void;
    adapter.mockImplementation((config) => new Promise((resolve) => {
      finish = () => resolve({ data: snapshot, status: 200, statusText: 'OK', headers: {}, config });
    }));
    const request = verifyAndSaveToken('  test-candidate  ');
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer test-candidate');
    expect(adapter.mock.calls[0][0].url).toBe('/v1/balances');
    expect(setItem).not.toHaveBeenCalled();
    expect(getSession().token).toBeNull();
    finish();
    await request;
    expect(getSession().token).toBe('test-candidate');
    expect([...values.values()]).toEqual(['test-candidate']);
  });

  it('reuses the verification snapshot for five seconds without another balance request', async () => {
    adapter.mockImplementation(respond());
    await verifyAndSaveToken('test-candidate');
    const client = createSessionQueryClient();
    try {
      const options = balancesQueryOptions(getSession().version);
      expect(await client.fetchQuery(options)).toEqual(snapshot);
      expect(adapter).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5001);
      expect(await client.fetchQuery(options)).toEqual(snapshot);
      expect(adapter).toHaveBeenCalledTimes(2);
    } finally {
      client.clear();
    }
  });

  it.each([401, 429, 503])('does not save a candidate or alter an existing session after HTTP %i', async (status) => {
    saveToken('test-original');
    const previous = getSession();
    setItem.mockClear();
    adapter.mockImplementation(async (config) => {
      expect(config.headers.get('Authorization')).toBe('Bearer test-candidate');
      throw new AxiosError('Rejected', 'ERR_BAD_RESPONSE', config, undefined, {
        data: {}, status, statusText: 'Error', headers: {}, config,
      });
    });
    await expect(verifyAndSaveToken('test-candidate')).rejects.toMatchObject({ status });
    expect(getSession()).toBe(previous);
    expect(setItem).not.toHaveBeenCalled();
    expect([...values.values()]).toEqual(['test-original']);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('does not persist after a transport timeout', async () => {
    adapter.mockRejectedValue(new AxiosError('Timeout', 'ECONNABORTED'));
    await expect(verifyAndSaveToken('test-candidate')).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(setItem).not.toHaveBeenCalled();
    expect(getSession().token).toBeNull();
  });

  it('rejects an invalid successful response before saving', async () => {
    adapter.mockImplementation(respond({ items: [] }));
    await expect(verifyAndSaveToken('test-candidate')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not make a request for an empty token', async () => {
    await expect(verifyAndSaveToken('   ')).rejects.toMatchObject({ code: 'CLIENT_VALIDATION' });
    expect(adapter).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not activate the token if browser storage refuses it', async () => {
    adapter.mockImplementation(respond());
    setItem.mockImplementation(() => { throw new Error('Storage blocked'); });
    await expect(verifyAndSaveToken('test-candidate')).rejects.toThrow('Could not save');
    expect(getSession().token).toBeNull();
    expect(getSession().initialBalances).toBeUndefined();
  });

  it('discards a late validation result when the session changes', async () => {
    let finish!: () => void;
    adapter.mockImplementation((config) => new Promise((resolve) => {
      finish = () => resolve({ data: snapshot, status: 200, statusText: 'OK', headers: {}, config });
    }));
    const request = verifyAndSaveToken('test-candidate');
    saveToken('test-replacement');
    finish();
    await expect(request).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(getSession().token).toBe('test-replacement');
  });

  it('does not persist a validation response after cancellation', async () => {
    let finish!: () => void;
    adapter.mockImplementation((config) => new Promise((resolve) => {
      finish = () => resolve({ data: snapshot, status: 200, statusText: 'OK', headers: {}, config });
    }));
    const controller = new AbortController();
    const request = verifyAndSaveToken('test-candidate', controller.signal);
    controller.abort();
    finish();
    await expect(request).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(setItem).not.toHaveBeenCalled();
  });
});
