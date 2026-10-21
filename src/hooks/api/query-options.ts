import { queryOptions } from '@tanstack/react-query';

import { fetchBalances } from '../../api/balances/balances.api';
import { fetchClaim, fetchClaimOptions } from '../../api/claims/claims.api';
import { ApiError } from '../../api/errors';

import { apiQueryKeys } from './query-keys';
import { apiReadPolicy, isActiveSession, pollingInterval, sessionRequest } from './query-policy';

export function balancesQueryOptions(version: number) {
  return queryOptions({
    ...apiReadPolicy,
    queryKey: apiQueryKeys.balances(version),
    queryFn: ({ signal }) => sessionRequest(version, fetchBalances, signal),
    enabled: isActiveSession(version),
    staleTime: 5000,
    refetchInterval: (query) => pollingInterval(query.state.error, 30_000),
  });
}

export function claimOptionsQueryOptions(version: number, asset?: string) {
  return queryOptions({
    ...apiReadPolicy,
    queryKey: apiQueryKeys.claimOptions(version, asset),
    queryFn: ({ signal }) => {
      if (!asset) throw new ApiError({ code: 'CLIENT_VALIDATION', message: 'Select an asset.' });
      return sessionRequest(version, (requestSignal) => fetchClaimOptions(asset, requestSignal), signal);
    },
    enabled: isActiveSession(version) && !!asset,
    staleTime: 0,
  });
}

export function claimQueryOptions(version: number, id?: string) {
  return queryOptions({
    ...apiReadPolicy,
    queryKey: apiQueryKeys.claim(version, id),
    queryFn: ({ signal }) => {
      if (!id) throw new ApiError({ code: 'CLIENT_VALIDATION', message: 'Select a Claim.' });
      return sessionRequest(version, (requestSignal) => fetchClaim(id, requestSignal), signal);
    },
    enabled: isActiveSession(version) && !!id,
    staleTime: 0,
    refetchInterval: (query) => {
      if (query.state.data && query.state.data.status !== 'pending') return false;
      return pollingInterval(query.state.error, 2000);
    },
  });
}
