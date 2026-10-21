import { QueryClient } from '@tanstack/react-query';

import { apiQueryKeys } from '../../hooks/api/query-keys';

import { getSession } from './session';

export function createSessionQueryClient() {
  const client = new QueryClient();
  const { version, initialBalances } = getSession();
  if (initialBalances) {
    client.setQueryData(apiQueryKeys.balances(version), initialBalances.data, { updatedAt: initialBalances.updatedAt });
  }
  return client;
}
