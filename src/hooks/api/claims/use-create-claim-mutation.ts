import { mutationOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { createClaim } from '../../../api/claims/claims.api';
import { useSession } from '../../../features/auth/use-session';
import type { TCreateClaimVariables } from '../../../types/features/claims';

import { apiQueryKeys } from '../query-keys';
import { isActiveSession, sessionRequest } from '../query-policy';

export function createClaimMutationOptions(queryClient: QueryClient, version: number) {
  return mutationOptions({
    mutationKey: apiQueryKeys.createClaim(version),
    mutationFn: ({ payload, idempotencyKey }: TCreateClaimVariables) => sessionRequest(
      version,
      () => createClaim(payload, idempotencyKey),
    ),
    retry: false,
    onSuccess: (claim) => {
      if (!isActiveSession(version)) return;
      queryClient.setQueryData(apiQueryKeys.claim(version, claim.id), claim);
      // Keep the balance snapshot intact; only refetch it from the server.
      void queryClient.invalidateQueries({ queryKey: apiQueryKeys.balances(version) });
    },
  });
}

export function useCreateClaimMutation() {
  const session = useSession();
  const queryClient = useQueryClient();
  return useMutation(createClaimMutationOptions(queryClient, session.version));
}
