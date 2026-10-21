import axios, { AxiosError, CanceledError, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveToken, signOut } from '../features/auth/session';

import { setupAxios } from './axios';
import { fetchBalances } from './balances/balances.api';
import { createClaim, fetchClaim, fetchClaimOptions } from './claims/claims.api';
import { API_BASE_URL } from './config';

const claim = {
  id: 'clm_test', asset: 'ETH', amount: '0.5', fee: '0.0012', receiveAmount: '0.4988',
  destinationId: 'dest_wallet', status: 'pending', failureReason: null,
  createdAt: '2026-10-21T08:00:00.000Z', updatedAt: '2026-10-21T08:00:00.000Z',
};
const body = { asset: 'ETH', amount: '0.5', destinationId: 'dest_wallet' };
const originalAdapter = axios.defaults.adapter;
let adapter = vi.fn<AxiosAdapter>();
let dispose: () => void;

function success(data: unknown, status = 200): AxiosAdapter {
  return async (config) => ({ data, status, statusText: 'OK', headers: {}, config });
}

function failure(status: number, data: unknown, headers = {}): AxiosAdapter {
  return async (config) => {
    throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, {
      data, status, statusText: 'Error', headers, config,
    });
  };
}

beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  const values = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: {
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  saveToken('test-token');
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
});

describe('API services', () => {
  it('uses the configured URL and active session for a cancellable balance request', async () => {
    const snapshot = { asOf: claim.createdAt, items: [] };
    adapter.mockImplementation(success(snapshot));
    const controller = new AbortController();
    expect(await fetchBalances(controller.signal)).toEqual(snapshot);
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe('/v1/balances');
    expect(config.baseURL).toBe(API_BASE_URL);
    expect(config.headers.get('Authorization')).toBe('Bearer test-token');
    controller.abort();
    expect(config.signal?.aborted).toBe(true);
  });

  it('passes the asset as a query parameter and rejects options for a different asset', async () => {
    const options = { asset: 'ETH', minAmount: '0.01', fee: '0.0012', destinations: [] };
    adapter.mockImplementationOnce(success(options)).mockImplementationOnce(success({ ...options, asset: 'BTC' }));
    expect(await fetchClaimOptions('ETH')).toEqual(options);
    expect(adapter.mock.calls[0][0].params).toEqual({ asset: 'ETH' });
    await expect(fetchClaimOptions('ETH')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });

  it.each([200, 201])('accepts a Claim response with HTTP %i and preserves the exact amount and key', async (status) => {
    adapter.mockImplementation(success(claim, status));
    const payload = { ...body, amount: '0.50' };
    expect(await createClaim(payload, 'persisted-key')).toEqual(claim);
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe('/v1/claims');
    expect(config.headers.get('Idempotency-Key')).toBe('persisted-key');
    expect(JSON.parse(config.data)).toEqual(payload);
  });

  it('rejects invalid request bodies and idempotency keys before sending', async () => {
    await expect(createClaim({ ...body, amount: '1e-3' }, 'key')).rejects.toMatchObject({ code: 'CLIENT_VALIDATION', field: 'amount' });
    await expect(createClaim(body, '')).rejects.toMatchObject({ code: 'CLIENT_VALIDATION' });
    await expect(createClaim(body, 'x'.repeat(101))).rejects.toMatchObject({ code: 'CLIENT_VALIDATION' });
    expect(adapter).not.toHaveBeenCalled();
  });

  it('rejects a successful response for a different Claim intent', async () => {
    adapter.mockImplementation(success({ ...claim, amount: '0.6' }, 201));
    await expect(createClaim(body, 'key')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 201 });
  });

  it.each([0.5, 'invalid', '1e-3'])('rejects a malformed successful Claim amount: %j', async (amount) => {
    adapter.mockImplementation(success({ ...claim, amount }, 201));
    await expect(createClaim(body, 'key')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 201 });
  });

  it('encodes Claim ids and rejects an unrelated Claim response', async () => {
    adapter.mockImplementationOnce(success({ ...claim, id: 'clm/id' })).mockImplementationOnce(success(claim));
    await fetchClaim('clm/id');
    expect(adapter.mock.calls[0][0].url).toBe('/v1/claims/clm%2Fid');
    await expect(fetchClaim('another-id')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('preserves cancellation instead of converting it to a network failure', async () => {
    const cancellation = new CanceledError('Cancelled');
    adapter.mockRejectedValue(cancellation);
    await expect(fetchBalances()).rejects.toBe(cancellation);
  });

  it('invalidates the current token on 401 and exposes a normalized error', async () => {
    adapter.mockImplementation(failure(401, { error: { code: 'UNAUTHORIZED', message: 'Token expired' } }));
    await expect(fetchBalances()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'Token expired' });
    await expect(fetchBalances()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('preserves server validation fields', async () => {
    adapter.mockImplementation(failure(400, { error: { code: 'VALIDATION', message: 'Insufficient funds', field: 'amount' } }));
    await expect(createClaim(body, 'key')).rejects.toMatchObject({
      status: 400, code: 'VALIDATION', field: 'amount', message: 'Insufficient funds',
    });
  });

  it.each([409, 500, 503, 504])('does not retry POST after HTTP %i', async (status) => {
    adapter.mockImplementation(failure(status, '<html>Error</html>'));
    await expect(createClaim(body, 'key')).rejects.toMatchObject({ status });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])('does not retry POST after %s', async (code) => {
    adapter.mockRejectedValue(new AxiosError('Transport error', code));
    await expect(createClaim(body, 'key')).rejects.toMatchObject({ code: code === 'ERR_NETWORK' ? 'NETWORK' : 'TIMEOUT' });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('preserves body rate-limit delays, including zero', async () => {
    for (const retryAfterMs of [2300, 0]) {
      adapter.mockImplementation(failure(429, {
        error: { code: 'RATE_LIMITED', message: 'Wait', retryAfterMs },
      }, { 'Retry-After': '10' }));
      await expect(fetchBalances()).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterMs });
    }
  });

  it('falls back to Retry-After seconds for a malformed error body', async () => {
    adapter.mockImplementation(failure(429, {}, { 'Retry-After': '3' }));
    await expect(fetchBalances()).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterMs: 3000 });
  });

  it('supports Retry-After HTTP dates', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(claim.createdAt));
    adapter.mockImplementation(failure(429, {}, { 'Retry-After': 'Wed, 21 Oct 2026 08:00:05 GMT' }));
    await expect(fetchBalances()).rejects.toMatchObject({ retryAfterMs: 5000 });
  });

  it('rejects numeric money in a balance response', async () => {
    adapter.mockImplementation(success({ asOf: claim.createdAt, items: [{
      asset: 'ETH', decimals: 18, available: 1, pending: '0', claiming: '0', usdPrice: '2000',
    }] }));
    await expect(fetchBalances()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });
});
