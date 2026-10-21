import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchBalances } from '../../api/balances/balances.api';
import { createClaim, fetchClaim, fetchClaimOptions } from '../../api/claims/claims.api';
import { ApiError } from '../../api/errors';
import { getSession, saveToken, signOut } from '../../features/auth/session';
import type { TClaim } from '../../types/entities/claim';

import { createClaimMutationOptions } from './claims/use-create-claim-mutation';
import { apiQueryKeys } from './query-keys';
import { balancesQueryOptions, claimOptionsQueryOptions, claimQueryOptions } from './query-options';
import { apiReadPolicy } from './query-policy';

vi.mock('../../api/balances/balances.api', () => ({ fetchBalances: vi.fn() }));
vi.mock('../../api/claims/claims.api', () => ({
  createClaim: vi.fn(), fetchClaim: vi.fn(), fetchClaimOptions: vi.fn(),
}));

const snapshot = { asOf: '2026-10-21T08:00:00.000Z', items: [] };
const claim: TClaim = {
  id: 'clm_test', asset: 'ETH', amount: '0.5', fee: '0.0012', receiveAmount: '0.4988',
  destinationId: 'dest_wallet', status: 'pending', failureReason: null,
  createdAt: snapshot.asOf, updatedAt: snapshot.asOf,
};
const variables = {
  payload: { asset: claim.asset, amount: claim.amount, destinationId: claim.destinationId },
  idempotencyKey: 'saved-key',
};
let client: QueryClient;
let version: number;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { localStorage: { setItem: vi.fn(), removeItem: vi.fn() } });
  saveToken('test-token');
  version = getSession().version;
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
});

afterEach(() => {
  signOut();
  client.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('API query options', () => {
  it('does not start automatic reads without a token or required parameter', () => {
    const observer = new QueryObserver(client, claimOptionsQueryOptions(version));
    const unsubscribe = observer.subscribe(() => {});
    expect(fetchClaimOptions).not.toHaveBeenCalled();
    unsubscribe();
    signOut();
    expect(balancesQueryOptions(getSession().version).enabled).toBe(false);
    expect(claimQueryOptions(getSession().version, claim.id).enabled).toBe(false);
  });

  it('separates assets, Claim ids, and sessions without putting tokens in keys', () => {
    expect(apiQueryKeys.claimOptions(version, 'ETH')).not.toEqual(apiQueryKeys.claimOptions(version, 'BTC'));
    expect(apiQueryKeys.claim(version, 'one')).not.toEqual(apiQueryKeys.claim(version, 'two'));
    saveToken('replacement-token');
    expect(apiQueryKeys.balances(version)).not.toEqual(apiQueryKeys.balances(getSession().version));
    expect(JSON.stringify(apiQueryKeys.balances(version))).not.toContain('test-token');
  });

  it('passes cancellation to balance reads and preserves the server snapshot', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(fetchBalances).mockImplementation(async (requestSignal) => {
      signal = requestSignal;
      return snapshot;
    });
    expect(await client.fetchQuery(balancesQueryOptions(version))).toEqual(snapshot);
    signOut();
    expect(signal?.aborted).toBe(true);
  });

  it.each(['VALIDATION', 'UNAUTHORIZED', 'INVALID_RESPONSE', 'CLIENT_VALIDATION', 'API_CONFIG'])(
    'does not retry %s',
    async (code) => {
      const error = new ApiError({ code, message: 'Stop' });
      vi.mocked(fetchBalances).mockRejectedValue(error);
      await expect(client.fetchQuery(balancesQueryOptions(version))).rejects.toBe(error);
      expect(fetchBalances).toHaveBeenCalledTimes(1);
    },
  );

  it('bounds transient GET retries and recovers on the third attempt', async () => {
    vi.mocked(fetchBalances)
      .mockRejectedValueOnce(new ApiError({ code: 'SERVER', status: 503, message: 'Retry' }))
      .mockRejectedValueOnce(new ApiError({ code: 'NETWORK', message: 'Retry' }))
      .mockResolvedValue(snapshot);
    const result = client.fetchQuery(balancesQueryOptions(version));
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toEqual(snapshot);
    expect(fetchBalances).toHaveBeenCalledTimes(3);
    expect(apiReadPolicy.retry(2, new ApiError({ code: 'NETWORK', message: 'Stop' }))).toBe(false);
  });

  it('honors a token-wide rate-limit delay across different endpoints', async () => {
    vi.mocked(fetchBalances).mockRejectedValue(new ApiError({
      code: 'RATE_LIMITED', status: 429, message: 'Wait', retryAfterMs: 5000,
    }));
    await expect(client.fetchQuery({ ...balancesQueryOptions(version), retry: false })).rejects.toMatchObject({ status: 429 });
    vi.mocked(fetchClaim).mockResolvedValue(claim);
    const result = client.fetchQuery(claimQueryOptions(version, claim.id));
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchClaim).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual(claim);
  });

  it('cancels a rate-limit wait when the token changes', async () => {
    vi.mocked(fetchBalances).mockRejectedValue(new ApiError({
      code: 'RATE_LIMITED', status: 429, message: 'Wait', retryAfterMs: 5000,
    }));
    await expect(client.fetchQuery({ ...balancesQueryOptions(version), retry: false })).rejects.toMatchObject({ status: 429 });
    const result = client.fetchQuery(claimQueryOptions(version, claim.id));
    saveToken('replacement-token');
    await expect(result).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(fetchClaim).not.toHaveBeenCalled();
  });

  it('refuses to execute options captured by an old session', async () => {
    const options = balancesQueryOptions(version);
    saveToken('replacement-token');
    await expect(client.fetchQuery(options)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetchBalances).not.toHaveBeenCalled();
  });

  it.each(['pending', 'completed', 'failed'] as const)('polls only nonterminal Claims: %s', (status) => {
    const options = claimQueryOptions(version, claim.id);
    client.setQueryData(options.queryKey, { ...claim, status });
    const query = client.getQueryCache().build<TClaim, unknown, TClaim, ReturnType<typeof apiQueryKeys.claim>>(client, options);
    if (typeof options.refetchInterval !== 'function') throw new Error('Expected a polling policy.');
    expect(options.refetchInterval(query)).toBe(status === 'pending' ? 2000 : false);
  });
});

describe('Claim mutation options', () => {
  it('caches the Claim and invalidates balances without changing their snapshot', async () => {
    vi.mocked(createClaim).mockResolvedValue(claim);
    client.setQueryData(apiQueryKeys.balances(version), snapshot);
    const observer = new MutationObserver(client, createClaimMutationOptions(client, version));
    expect(await observer.mutate(variables)).toEqual(claim);
    expect(createClaim).toHaveBeenCalledWith(variables.payload, variables.idempotencyKey);
    expect(client.getQueryData(apiQueryKeys.claim(version, claim.id))).toEqual(claim);
    expect(client.getQueryData(apiQueryKeys.balances(version))).toEqual(snapshot);
    expect(client.getQueryState(apiQueryKeys.balances(version))?.isInvalidated).toBe(true);
  });

  it('does not retry a timed-out POST or populate a fabricated Claim', async () => {
    const timeout = new ApiError({ code: 'TIMEOUT', message: 'Unknown outcome' });
    vi.mocked(createClaim).mockRejectedValue(timeout);
    const observer = new MutationObserver(client, createClaimMutationOptions(client, version));
    await expect(observer.mutate(variables)).rejects.toBe(timeout);
    expect(createClaim).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(apiQueryKeys.claim(version, claim.id))).toBeUndefined();
    expect(observer.getCurrentResult().variables).toEqual(variables);
  });

  it('rejects mutation execution from a stale session', async () => {
    const observer = new MutationObserver(client, createClaimMutationOptions(client, version));
    saveToken('replacement-token');
    await expect(observer.mutate(variables)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(createClaim).not.toHaveBeenCalled();
  });

  it('does not write a late success into the cache after a session change', async () => {
    let finish!: (result: TClaim) => void;
    vi.mocked(createClaim).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const observer = new MutationObserver(client, createClaimMutationOptions(client, version));
    const result = observer.mutate(variables);
    await vi.advanceTimersByTimeAsync(0);
    saveToken('replacement-token');
    finish(claim);
    await result;
    expect(client.getQueryData(apiQueryKeys.claim(version, claim.id))).toBeUndefined();
    expect(client.getQueryData(apiQueryKeys.claim(getSession().version, claim.id))).toBeUndefined();
  });
});
