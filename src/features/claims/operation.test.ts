import { CanceledError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/errors';
import type { TClaim } from '../../types/entities/claim';
import type { TBalancesResponse } from '../../types/features/balances';
import type { TClaimOperation } from '../../types/features/claims';

import { claimStorageKey, executeClaimOperation, finishClaimOperation, isClaimReconciled, readClaimOperation, recordClaimStatus } from './operation';

const pending: TClaim = {
  id: 'clm_test', asset: 'ETH', amount: '0.5', fee: '0.0012', receiveAmount: '0.4988',
  destinationId: 'wallet', status: 'pending', failureReason: null,
  createdAt: '2026-10-21T08:00:00.000Z', updatedAt: '2026-10-21T08:00:00.000Z',
};
const completed: TClaim = { ...pending, status: 'completed', updatedAt: '2026-10-21T08:00:20.000Z' };
const freshBalances: TBalancesResponse = {
  asOf: '2026-10-21T08:00:30.000Z',
  items: [{ asset: 'ETH', decimals: 8, available: '0.5', pending: '0', claiming: '0', usdPrice: '2000' }],
};
let values: Map<string, string>;
let setItem = vi.fn();
let key: string;

function initial(): TClaimOperation {
  return {
    payload: { asset: 'ETH', amount: '0.50', destinationId: 'wallet' }, idempotencyKey: 'original-key',
    fee: '0.0012', receiveAmount: '0.4988', destinationLabel: 'My wallet',
    claim: null, rejection: null, errorMessage: null,
  };
}

beforeEach(async () => {
  values = new Map();
  setItem = vi.fn((key: string, value: string) => { values.set(key, value); });
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null, setItem,
    removeItem: (key: string) => values.delete(key),
  } });
  const locks = new Set<string>();
  vi.stubGlobal('navigator', { locks: {
    request: async <TData>(name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<TData>) => {
      if (options.ifAvailable && options.signal !== undefined) {
        throw new DOMException('ifAvailable and signal cannot be used together', 'NotSupportedError');
      }
      if (locks.has(name)) return callback(null);
      locks.add(name);
      try { return await callback({ name, mode: 'exclusive' }); } finally { locks.delete(name); }
    },
  } });
  key = await claimStorageKey('test-token');
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('persisted Claim intent and recovery', () => {
  it('submits with a session signal using browser-compatible lock options', async () => {
    const controller = new AbortController();
    const send = vi.fn().mockResolvedValue(pending);
    const result = await executeClaimOperation(key, initial(), send, vi.fn(), controller.signal);
    expect(result.claim).toEqual(pending);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not persist or send a claim for an already ended session', async () => {
    const controller = new AbortController();
    controller.abort();
    const send = vi.fn();
    await expect(executeClaimOperation(key, initial(), send, vi.fn(), controller.signal))
      .rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(send).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('persists the exact amount and key before the first POST', async () => {
    const send = vi.fn(async () => {
      expect(readClaimOperation(key)?.payload.amount).toBe('0.50');
      expect(readClaimOperation(key)?.idempotencyKey).toBe('original-key');
      expect(readClaimOperation(key)?.claim).toBeNull();
      return pending;
    });
    const changed = vi.fn();
    const result = await executeClaimOperation(key, initial(), send, changed);
    expect(result.claim).toEqual(pending);
    expect(readClaimOperation(key)?.claim?.id).toBe(pending.id);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('does not send when recovery storage refuses the initial intent', async () => {
    setItem.mockImplementation(() => { throw new Error('Storage blocked'); });
    const send = vi.fn();
    await expect(executeClaimOperation(key, initial(), send, vi.fn())).rejects.toThrow('Could not save');
    expect(send).not.toHaveBeenCalled();
  });

  it('recovers after a lost response and reload using the same body and key', async () => {
    const timeout = new ApiError({ code: 'TIMEOUT', status: 504, message: 'Outcome unknown' });
    const first = vi.fn().mockRejectedValue(timeout);
    await expect(executeClaimOperation(key, initial(), first, vi.fn())).rejects.toBe(timeout);
    expect(readClaimOperation(key)).toMatchObject({ claim: null, rejection: null });
    const replay = vi.fn().mockResolvedValue(completed);
    expect((await executeClaimOperation(key, null, replay, vi.fn())).claim).toEqual(completed);
    expect(replay).toHaveBeenCalledWith(first.mock.calls[0][0]);
    expect(replay).toHaveBeenCalledWith({ payload: initial().payload, idempotencyKey: 'original-key' });
  });

  it('blocks a second submission while another sender holds the browser lock', async () => {
    const controller = new AbortController();
    let finish!: (claim: TClaim) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const send = vi.fn(() => new Promise<TClaim>((resolve) => { finish = resolve; started(); }));
    const first = executeClaimOperation(key, initial(), send, vi.fn(), controller.signal);
    await ready;
    await expect(executeClaimOperation(key, initial(), send, vi.fn(), controller.signal)).rejects.toThrow('Another tab');
    finish(pending);
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('refuses a new key while an earlier operation is unresolved', async () => {
    values.set(key, JSON.stringify(initial()));
    const send = vi.fn();
    await expect(executeClaimOperation(key, { ...initial(), idempotencyKey: 'new-key' }, send, vi.fn())).rejects.toThrow('Finish the saved claim');
    expect(readClaimOperation(key)?.idempotencyKey).toBe('original-key');
    expect(send).not.toHaveBeenCalled();
  });

  it.each([409, 500, 503, 504])('preserves an ambiguous HTTP %i outcome', async (status) => {
    const send = vi.fn().mockRejectedValue(new ApiError({ code: 'SERVER', status, message: 'Unconfirmed' }));
    await expect(executeClaimOperation(key, initial(), send, vi.fn())).rejects.toMatchObject({ status });
    expect(readClaimOperation(key)).toMatchObject({ claim: null, rejection: null, idempotencyKey: 'original-key' });
  });

  it.each([
    new ApiError({ code: 'INVALID_RESPONSE', status: 201, message: 'Malformed reply' }),
    new ApiError({ code: 'NETWORK', message: 'Disconnected' }),
    new CanceledError('Cancelled'),
  ])('keeps recovery intent after %s', async (error) => {
    await expect(executeClaimOperation(key, initial(), vi.fn().mockRejectedValue(error), vi.fn())).rejects.toBe(error);
    expect(readClaimOperation(key)?.rejection).toBeNull();
  });

  it('allows acknowledgement after explicit server validation rejection', async () => {
    const error = new ApiError({ code: 'VALIDATION', status: 400, message: 'Insufficient available funds' });
    await expect(executeClaimOperation(key, initial(), vi.fn().mockRejectedValue(error), vi.fn())).rejects.toBe(error);
    expect(readClaimOperation(key)?.rejection).toBe(error.message);
    await finishClaimOperation(key);
    expect(readClaimOperation(key)).toBeNull();
  });

  it('keeps an unknown intent if saving the successful response fails', async () => {
    const send = vi.fn(async () => {
      setItem.mockImplementation(() => { throw new Error('Storage failed'); });
      return pending;
    });
    await expect(executeClaimOperation(key, initial(), send, vi.fn())).rejects.toThrow('Could not save');
    expect(readClaimOperation(key)).toMatchObject({ claim: null, idempotencyKey: 'original-key' });
  });

  it('does not send another POST once the Claim id is known', async () => {
    values.set(key, JSON.stringify({ ...initial(), claim: pending }));
    const send = vi.fn();
    const changed = vi.fn();
    expect((await executeClaimOperation(key, null, send, changed)).claim).toEqual(pending);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ claim: pending }));
    expect(send).not.toHaveBeenCalled();
  });

  it('isolates recovery data between tokens without storing a raw token in the key', async () => {
    values.set(key, JSON.stringify(initial()));
    const otherKey = await claimStorageKey('test-other-token');
    expect(otherKey).not.toBe(key);
    expect(key).not.toContain('test-token');
    expect(readClaimOperation(otherKey)).toBeNull();
  });

  it('blocks recovery and new submissions when saved data is malformed', async () => {
    values.set(key, '{broken');
    const send = vi.fn();
    await expect(executeClaimOperation(key, initial(), send, vi.fn())).rejects.toThrow('Saved claim data is invalid');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a Claim response belonging to another intent', async () => {
    await expect(executeClaimOperation(key, initial(), vi.fn().mockResolvedValue({ ...pending, asset: 'BTC' }), vi.fn())).rejects.toThrow('does not match');
    expect(readClaimOperation(key)?.claim).toBeNull();
  });

  it('blocks an inconsistent saved operation that is both accepted and rejected', () => {
    values.set(key, JSON.stringify({ ...initial(), claim: pending, rejection: 'Rejected' }));
    expect(() => readClaimOperation(key)).toThrow('Saved claim data is invalid');
  });

  it('refuses submission when cross-tab locking is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const send = vi.fn();
    await expect(executeClaimOperation(key, initial(), send, vi.fn())).rejects.toThrow('Web Locks');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('status persistence and balance reconciliation', () => {
  it('persists a failed status and its failure reason', async () => {
    values.set(key, JSON.stringify({ ...initial(), claim: pending }));
    const failed = { ...completed, status: 'failed' as const, failureReason: 'Destination unavailable' };
    await recordClaimStatus(key, failed);
    expect(readClaimOperation(key)?.claim).toEqual(failed);
  });

  it('does not roll a settled Claim back to pending', async () => {
    values.set(key, JSON.stringify({ ...initial(), claim: completed }));
    expect((await recordClaimStatus(key, pending)).claim).toEqual(completed);
  });

  it('does not accept a status for another Claim id', async () => {
    values.set(key, JSON.stringify({ ...initial(), claim: pending }));
    await expect(recordClaimStatus(key, { ...completed, id: 'clm_other' })).rejects.toThrow('does not match');
  });

  it.each(['completed', 'failed'] as const)('requires a newer snapshot after %s', async (status) => {
    const operation = { ...initial(), claim: { ...completed, status } };
    values.set(key, JSON.stringify(operation));
    expect(isClaimReconciled(operation, { ...freshBalances, asOf: pending.createdAt })).toBe(false);
    expect(isClaimReconciled(operation, { ...freshBalances, asOf: completed.updatedAt })).toBe(false);
    await expect(finishClaimOperation(key, { ...freshBalances, asOf: completed.updatedAt })).rejects.toThrow('newer balance');
    expect(isClaimReconciled(operation, freshBalances)).toBe(true);
    await finishClaimOperation(key, freshBalances);
    expect(readClaimOperation(key)).toBeNull();
  });

  it('never treats a newer balance alone as proof of an unknown or pending Claim outcome', () => {
    expect(isClaimReconciled(initial(), freshBalances)).toBe(false);
    expect(isClaimReconciled({ ...initial(), claim: pending }, freshBalances)).toBe(false);
  });
});
