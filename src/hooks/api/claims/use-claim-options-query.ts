import { useQuery } from '@tanstack/react-query';

import { useSession } from '../../../features/auth/use-session';

import { claimOptionsQueryOptions } from '../query-options';

export function useClaimOptionsQuery(asset?: string) {
  const session = useSession();
  return useQuery(claimOptionsQueryOptions(session.version, asset));
}
