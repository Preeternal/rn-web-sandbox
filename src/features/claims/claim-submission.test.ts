import { MutationObserver, QueryClient, onlineManager } from '@tanstack/react-query';
import axios, { type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupAxios } from '../../api/axios';
import { getSession, saveToken, signOut } from '../auth/session';
import { createClaimMutationOptions } from '../../hooks/api/claims/use-create-claim-mutation';
import type { TClaim } from '../../types/entities/claim';
import type { TClaimOperation, TCreateClaimVariables } from '../../types/features/claims';

import { claimStorageKey, executeClaimOperation, readClaimOperation } from './operation';

const pending: TClaim = {
  id: 'clm_test', asset: 'ETH', amount: '0.5', fee: '0.0012', receiveAmount: '0.4988',
  destinationId: 'wallet', status: 'pending', failureReason: null,
  createdAt: '2026-10-21T08:00:00.000Z', updatedAt: '2026-10-21T08:00:00.000Z',
};
const completed: TClaim = { ...pending, status: 'completed', updatedAt: '2026-10-21T08:00:20.000Z' };
const originalAdapter = axios.defaults.adapter;
let adapter = vi.fn<AxiosAdapter>();
let dispose: () => void;
let key: string;
let activeLocks: Set<string>;
let clients: QueryClient[];

function initial(): TClaimOperation {
  return {
    payload: { asset: 'ETH', amount: '0.50', destinationId: 'wallet' }, idempotencyKey: 'original-key',
    fee: '0.0012', receiveAmount: '0.4988', destinationLabel: 'My wallet',
    claim: null, rejection: null, errorMessage: null,
  };
}

function mutation() {
  const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
  client.mount();
  clients.push(client);
  return new MutationObserver(client, createClaimMutationOptions(client, getSession().version));
}

beforeEach(async () => {
  vi.stubGlobal('__DEV__', false);
  const values = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  activeLocks = new Set();
  vi.stubGlobal('navigator', { locks: {
    request: async <TData>(name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<TData>) => {
      if (options.ifAvailable && options.signal !== undefined) {
        throw new DOMException('ifAvailable and signal cannot be used together', 'NotSupportedError');
      }
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (activeLocks.has(name)) return callback(null);
      activeLocks.add(name);
      try { return await callback({ name, mode: 'exclusive' }); } finally { activeLocks.delete(name); }
    },
  } });
  onlineManager.setOnline(true);
  clients = [];
  saveToken('test-token');
  key = await claimStorageKey('test-token');
  dispose = setupAxios();
  adapter = vi.fn<AxiosAdapter>();
  axios.defaults.adapter = adapter;
});

afterEach(() => {
  signOut();
  for (const client of clients) { client.clear(); client.unmount(); }
  onlineManager.setOnline(true);
  dispose();
  axios.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Claim submission regressions', () => {
  it('releases the lock on logout while offline and recovers after login without a stale reconnect POST', async () => {
    let finishOldRequest!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    adapter.mockImplementationOnce((config) => new Promise((resolve) => {
      // Ignore abort deliberately: lock release must not depend on transport settlement.
      finishOldRequest = () => resolve({ data: pending, status: 201, statusText: 'Created', headers: {}, config });
      started();
    })).mockImplementation(async (config) => ({ data: completed, status: 200, statusText: 'OK', headers: {}, config }));

    onlineManager.setOnline(false);
    const firstMutation = mutation();
    let oldMutation!: Promise<TClaim>;
    const send = (variables: TCreateClaimVariables) => {
      oldMutation = firstMutation.mutate(variables);
      return oldMutation;
    };
    const first = executeClaimOperation(key, initial(), send, vi.fn(), getSession().signal!);
    const cancelled = expect(first).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    await ready;
    expect(firstMutation.getCurrentResult().isPaused).toBe(false);
    expect(activeLocks.has(key)).toBe(true);
    signOut();
    await cancelled;
    expect(activeLocks.has(key)).toBe(false);
    expect(readClaimOperation(key)).toMatchObject({ claim: null, rejection: null, idempotencyKey: 'original-key' });

    onlineManager.setOnline(true);
    saveToken('test-token');
    const secondMutation = mutation();
    const result = await executeClaimOperation(key, null, (variables) => secondMutation.mutate(variables), vi.fn(), getSession().signal!);
    expect(result.claim).toEqual(completed);
    expect(adapter).toHaveBeenCalledTimes(2);
    const [firstConfig, secondConfig] = adapter.mock.calls.map(([config]) => config);
    expect(secondConfig.data).toBe(firstConfig.data);
    expect(secondConfig.headers.get('Idempotency-Key')).toBe(firstConfig.headers.get('Idempotency-Key'));

    finishOldRequest();
    await expect(oldMutation).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(readClaimOperation(key)?.claim).toEqual(completed);
    expect(activeLocks.has(key)).toBe(false);
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it('keeps the original intent after inconsistent POST amounts and replays with the same key', async () => {
    adapter.mockImplementationOnce(async (config) => ({
      data: { ...pending, receiveAmount: '999' }, status: 201, statusText: 'Created', headers: {}, config,
    })).mockImplementationOnce(async (config) => ({ data: completed, status: 200, statusText: 'OK', headers: {}, config }));
    const firstMutation = mutation();
    await expect(executeClaimOperation(key, initial(), (variables) => firstMutation.mutate(variables), vi.fn(), getSession().signal!))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 201 });
    expect(readClaimOperation(key)).toMatchObject({ claim: null, rejection: null, idempotencyKey: 'original-key', payload: initial().payload });
    expect(firstMutation.getCurrentResult().data).toBeUndefined();
    expect(activeLocks.has(key)).toBe(false);

    const replay = mutation();
    expect((await executeClaimOperation(key, null, (variables) => replay.mutate(variables), vi.fn(), getSession().signal!)).claim).toEqual(completed);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[1][0].data).toBe(adapter.mock.calls[0][0].data);
    expect(adapter.mock.calls[1][0].headers.get('Idempotency-Key')).toBe('original-key');
  });
});
