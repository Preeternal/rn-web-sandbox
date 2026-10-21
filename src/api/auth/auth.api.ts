import type { TBalancesResponse } from '../../types/features/balances';

import { balancesResponseSchema } from '../balances/balances.schemas';
import { ApiError } from '../errors';
import { requestApi } from '../request';

export async function validateToken(input: string, signal?: AbortSignal): Promise<TBalancesResponse> {
  const token = input.trim();
  if (!token) throw new ApiError({ code: 'CLIENT_VALIDATION', message: 'Enter an API token.', field: 'token' });
  return requestApi({
    method: 'GET',
    url: '/v1/balances',
    headers: { Authorization: `Bearer ${token}` },
    tokenValidation: true,
    signal,
    validateStatus: (status) => status === 200,
  }, balancesResponseSchema);
}
