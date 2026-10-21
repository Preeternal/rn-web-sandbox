import { useQuery } from '@tanstack/react-query';

import { useSession } from '../../../features/auth/use-session';

import { balancesQueryOptions } from '../query-options';

export function useBalancesQuery() {
  const session = useSession();
  return useQuery(balancesQueryOptions(session.version));
}
