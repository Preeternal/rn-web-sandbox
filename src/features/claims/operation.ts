import { Big } from 'big.js';
import { CanceledError } from 'axios';

import { ApiError } from '../../api/errors';
import type { TClaim } from '../../types/entities/claim';
import type { TBalancesResponse } from '../../types/features/balances';
import type { TClaimOperation, TSendClaim } from '../../types/features/claims';

import { claimOperationSchema } from './operation.schemas';

export async function claimStorageKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `rn-web-sandbox.claim.${hash}`;
}

function assertClaimMatches(operation: TClaimOperation, claim: TClaim) {
  if (claim.asset !== operation.payload.asset || claim.destinationId !== operation.payload.destinationId
    || !new Big(claim.amount).eq(operation.payload.amount)
    || (operation.claim && claim.id !== operation.claim.id)) {
    throw new Error('The Claim response does not match the saved operation. Recovery is required.');
  }
}

export function readClaimOperation(key: string): TClaimOperation | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  try {
    const operation = claimOperationSchema.parse(JSON.parse(raw));
    if (operation.claim) assertClaimMatches(operation, operation.claim);
    return operation;
  } catch {
    throw new Error('Saved claim data is invalid. New claims are blocked to prevent duplicates.');
  }
}

function writeClaimOperation(key: string, operation: TClaimOperation) {
  try {
    window.localStorage.setItem(key, JSON.stringify(claimOperationSchema.parse(operation)));
  } catch {
    throw new Error('Could not save claim recovery data. Allow browser storage before continuing.');
  }
}

function awaitClaimResult<TData>(result: Promise<TData>, signal?: AbortSignal): Promise<TData> {
  if (!signal) return result;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new CanceledError('The claim session has ended. Recover the saved operation after signing in.'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    // Observe late settlement but never resume the cancelled operation's writes.
    result.then((value) => {
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) onAbort();
      else resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener('abort', onAbort);
      reject(error);
    });
    if (signal.aborted) onAbort();
  });
}

async function withClaimLock<TData>(key: string, action: () => Promise<TData>, signal?: AbortSignal): Promise<TData> {
  if (signal?.aborted) throw new CanceledError('The claim session has ended.');
  if (typeof navigator === 'undefined' || !navigator.locks) {
    throw new Error('Safe claim submission requires a browser with Web Locks support and HTTPS or localhost.');
  }
  return navigator.locks.request(key, { ifAvailable: true, signal }, async (lock) => {
    if (!lock) throw new Error('Another tab is updating this claim. Wait for it to finish.');
    if (signal?.aborted) throw new CanceledError('The claim session has ended.');
    return action();
  });
}

export async function executeClaimOperation(
  key: string,
  initial: TClaimOperation | null,
  send: TSendClaim,
  onChange: (operation: TClaimOperation) => void,
  signal?: AbortSignal,
): Promise<TClaimOperation> {
  return withClaimLock(key, async () => {
    const saved = readClaimOperation(key);
    if (initial && saved) {
      onChange(saved);
      throw new Error('Finish the saved claim before starting another one.');
    }
    const operation = saved ?? initial;
    if (!operation) throw new Error('There is no saved claim to recover.');
    if (operation.claim || operation.rejection) {
      onChange(operation);
      return operation;
    }
    // Persist the exact intent before the first network request. A reload means unknown outcome.
    writeClaimOperation(key, operation);
    onChange(operation);
    try {
      if (signal?.aborted) throw new CanceledError('The claim session has ended.');
      // End the lock callback on logout even if the underlying transport never settles.
      const claim = await awaitClaimResult(send({ payload: operation.payload, idempotencyKey: operation.idempotencyKey }), signal);
      if (signal?.aborted) throw new CanceledError('The claim session has ended.');
      assertClaimMatches(operation, claim);
      const known = { ...operation, claim, errorMessage: null };
      writeClaimOperation(key, known);
      onChange(known);
      return known;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not confirm the claim outcome.';
      // These responses explicitly reject the request. Timeout, 5xx, 409, cancellation,
      // malformed success responses, and network failures must retain the original intent.
      const rejected = error instanceof ApiError && (error.status === 400 || error.status === 404 || error.code === 'CLIENT_VALIDATION');
      const updated = { ...operation, errorMessage: message, rejection: rejected ? message : null };
      writeClaimOperation(key, updated);
      onChange(updated);
      throw error;
    }
  }, signal);
}

export async function recordClaimStatus(key: string, claim: TClaim): Promise<TClaimOperation> {
  return withClaimLock(key, async () => {
    const operation = readClaimOperation(key);
    if (!operation) throw new Error('Saved claim recovery data is missing.');
    assertClaimMatches(operation, claim);
    // A late pending response must never roll a settled operation back.
    if (operation.claim && (operation.claim.status !== 'pending'
      || Date.parse(operation.claim.updatedAt) > Date.parse(claim.updatedAt))) return operation;
    const updated = { ...operation, claim, errorMessage: null, rejection: null };
    writeClaimOperation(key, updated);
    return updated;
  });
}

export function isClaimReconciled(operation: TClaimOperation, balances?: TBalancesResponse): boolean {
  if (operation.rejection) return true;
  const claim = operation.claim;
  return !!claim && claim.status !== 'pending' && !!balances
    && balances.items.some((balance) => balance.asset === claim.asset)
    && Date.parse(balances.asOf) > Date.parse(claim.updatedAt);
}

export async function finishClaimOperation(key: string, balances?: TBalancesResponse): Promise<void> {
  return withClaimLock(key, async () => {
    const operation = readClaimOperation(key);
    if (!operation || !isClaimReconciled(operation, balances)) {
      throw new Error('Wait for a completed or failed claim and a newer balance snapshot before starting another claim.');
    }
    window.localStorage.removeItem(key);
  });
}
