import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSession } from '../../../features/auth/use-session';

import { apiQueryKeys } from '../query-keys';
import { claimQueryOptions } from '../query-options';
import { isActiveSession } from '../query-policy';

export function useClaimQuery(id?: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const query = useQuery(claimQueryOptions(session.version, id));
  const status = query.data?.status;

  useEffect(() => {
    if (isActiveSession(session.version) && (status === 'completed' || status === 'failed')) {
      void queryClient.invalidateQueries({ queryKey: apiQueryKeys.balances(session.version) });
    }
  }, [queryClient, session.version, id, status]);

  return query;
}
