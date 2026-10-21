import { CanceledError } from 'axios';

import { validateToken } from '../../api/auth/auth.api';

import { getSession, saveToken } from './session';

export async function verifyAndSaveToken(input: string, signal?: AbortSignal): Promise<void> {
  const version = getSession().version;
  const balances = await validateToken(input, signal);
  if (signal?.aborted || getSession().version !== version) {
    throw new CanceledError('Token validation is no longer active.');
  }
  saveToken(input, { data: balances, updatedAt: Date.now() });
}
