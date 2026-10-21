import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { ApiError } from '../../api/errors';
import { useSession } from '../../features/auth/use-session';
import { apiQueryKeys } from '../../hooks/api/query-keys';
import { isActiveSession } from '../../hooks/api/query-policy';
import type { TClaimRecovery } from '../../types/features/claims';

import { claimStorageKey, readClaimOperation } from './operation';

export function useClaimRecovery() {
  const session = useSession();
  const client = useQueryClient();
  const queryKey = apiQueryKeys.claimRecovery(session.version);
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<TClaimRecovery> => {
      if (!session.token) throw new ApiError({ code: 'AUTH_REQUIRED', message: 'Enter an API token.' });
      const storageKey = await claimStorageKey(session.token);
      if (!isActiveSession(session.version)) throw new Error('The API session has changed.');
      return { storageKey, operation: readClaimOperation(storageKey) };
    },
    enabled: session.ready && !!session.token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: 'always',
  });

  const key = query.data?.storageKey;
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        void client.invalidateQueries({ queryKey: apiQueryKeys.claimRecovery(session.version) });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [client, session.version, key]);

  return query;
}
