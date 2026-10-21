import { CanceledError, isCancel } from 'axios';

import { ApiError } from '../../api/errors';
import { getSession } from '../../features/auth/session';

let cooldownVersion = -1;
let cooldownUntil = 0;

export function isActiveSession(version: number) {
  const session = getSession();
  return session.ready && !!session.token && session.version === version;
}

export function canRetryApiRead(error: unknown) {
  if (isCancel(error) || !(error instanceof ApiError)) return false;
  if (error.status === 429) return true;
  if (error.status !== undefined) return error.status >= 500;
  return error.code === 'NETWORK' || error.code === 'TIMEOUT';
}

export const apiReadPolicy = {
  retry: (failureCount: number, error: unknown) => failureCount < 2 && canRetryApiRead(error),
  retryDelay: (attempt: number, error: unknown) => Math.max(
    Math.min(1000 * 2 ** attempt, 30_000),
    error instanceof ApiError ? error.retryAfterMs ?? 0 : 0,
  ),
  refetchIntervalInBackground: false,
};

export function pollingInterval(error: unknown, interval: number): number | false {
  return error && !canRetryApiRead(error) ? false : interval;
}

async function waitForCooldown(version: number, signal: AbortSignal) {
  while (cooldownVersion === version && cooldownUntil > Date.now()) {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(new CanceledError('API request cancelled.'));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, Math.min(cooldownUntil - Date.now(), 2_147_483_647));
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }
}

export async function sessionRequest<TData>(
  version: number,
  request: (signal: AbortSignal) => Promise<TData>,
  signal?: AbortSignal,
): Promise<TData> {
  const session = getSession();
  if (!isActiveSession(version) || !session.signal) {
    throw new ApiError({ code: 'AUTH_REQUIRED', message: 'The API session is no longer active.' });
  }
  const requestSignal = signal ? AbortSignal.any([signal, session.signal]) : session.signal;
  await waitForCooldown(version, requestSignal);
  if (requestSignal.aborted || !isActiveSession(version)) throw new CanceledError('API request cancelled.');
  try {
    return await request(requestSignal);
  } catch (error) {
    // Rate limits apply to the token, so all endpoints share the same cooldown.
    if (isActiveSession(version) && error instanceof ApiError && error.status === 429) {
      cooldownUntil = Math.max(cooldownVersion === version ? cooldownUntil : 0, Date.now() + (error.retryAfterMs ?? 1000));
      cooldownVersion = version;
    }
    throw error;
  }
}
