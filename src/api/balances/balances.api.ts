import type { TBalancesResponse } from '../../types/features/balances';

import { requestApi } from '../request';
import { balancesResponseSchema } from './balances.schemas';

export async function fetchBalances(signal?: AbortSignal): Promise<TBalancesResponse> {
  return requestApi({ method: 'GET', url: '/v1/balances', signal }, balancesResponseSchema);
}
