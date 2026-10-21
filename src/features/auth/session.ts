import type { TSession } from '../../types/entities/session';

const TOKEN_STORAGE_KEY = 'rn-web-sandbox.api-token';

const initialSession: TSession = {
  ready: false,
  token: null,
  version: 0,
  notice: null,
  signal: null,
};

let session = initialSession;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function browserStorage(): Storage {
  if (typeof window === 'undefined') throw new Error('Browser storage is unavailable.');
  return window.localStorage;
}

function updateSession(token: string | null, notice: string | null = null, initialBalances?: TSession['initialBalances']) {
  controller?.abort();
  controller = token ? new AbortController() : null;
  session = {
    ready: true,
    token,
    version: session.version + 1,
    notice,
    signal: controller?.signal ?? null,
    initialBalances,
  };
  listeners.forEach((listener) => listener());
}

export function getSession() {
  return session;
}

// Static rendering always starts without access to browser storage.
export function getServerSession() {
  return initialSession;
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function restoreSession() {
  if (session.ready) return;
  try {
    const token = browserStorage().getItem(TOKEN_STORAGE_KEY)?.trim() || null;
    updateSession(token);
  } catch {
    updateSession(null, 'Could not read browser storage. Check browser settings and try saving your token again.');
  }
}

export function saveToken(input: string, initialBalances?: TSession['initialBalances']) {
  const token = input.trim();
  if (!token) throw new Error('Enter an API token.');
  try {
    browserStorage().setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    throw new Error('Could not save your token. Allow browser storage and try again.');
  }
  updateSession(token, null, initialBalances);
}

export function signOut() {
  try {
    browserStorage().removeItem(TOKEN_STORAGE_KEY);
  } catch {
    throw new Error('Could not remove your saved token. Check browser storage settings and try again.');
  }
  updateSession(null);
}

export function expireSession(requestVersion: number) {
  if (requestVersion !== session.version || !session.token) return;
  let notice = 'Your token was rejected or has expired. Enter it again.';
  try {
    browserStorage().removeItem(TOKEN_STORAGE_KEY);
  } catch {
    notice += ' The saved token could not be removed from browser storage.';
  }
  updateSession(null, notice);
}
