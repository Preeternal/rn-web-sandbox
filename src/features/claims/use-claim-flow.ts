import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useSession } from '../auth/use-session';
import { useBalancesQuery } from '../../hooks/api/balances/use-balances-query';
import { useClaimQuery } from '../../hooks/api/claims/use-claim-query';
import { useCreateClaimMutation } from '../../hooks/api/claims/use-create-claim-mutation';
import { apiQueryKeys } from '../../hooks/api/query-keys';
import { isActiveSession } from '../../hooks/api/query-policy';
import type { TClaimOperation, TClaimSubmission } from '../../types/features/claims';

import { executeClaimOperation, finishClaimOperation, isClaimReconciled, recordClaimStatus } from './operation';
import { useClaimRecovery } from './use-claim-recovery';

export function useClaimFlow() {
  const session = useSession();
  const client = useQueryClient();
  const recovery = useClaimRecovery();
  const balances = useBalancesQuery();
  const mutation = useCreateClaimMutation();
  const operation = recovery.data?.operation;
  const status = useClaimQuery(operation?.claim?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);

  function update(operation: TClaimOperation | null) {
    if (!recovery.data || !isActiveSession(session.version)) return;
    client.setQueryData(apiQueryKeys.claimRecovery(session.version), { ...recovery.data, operation });
    if (operation?.rejection) {
      void client.invalidateQueries({ queryKey: apiQueryKeys.balances(session.version) });
    }
  }

  const storageKey = recovery.data?.storageKey;
  const currentClaim = status.data;
  useEffect(() => {
    if (!storageKey || !operation?.claim || !currentClaim
      || (operation.claim.status === currentClaim.status && operation.claim.updatedAt === currentClaim.updatedAt)) return;
    let active = true;
    void recordClaimStatus(storageKey, currentClaim).then((updated) => {
      if (active && isActiveSession(session.version)) {
        client.setQueryData(apiQueryKeys.claimRecovery(session.version), { storageKey, operation: updated });
      }
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'Could not save claim status.');
    });
    return () => { active = false; };
  }, [client, storageKey, currentClaim, operation?.claim, session.version, status.dataUpdatedAt]);

  async function run(action: () => Promise<unknown>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      if (isActiveSession(session.version)) setError(failure instanceof Error ? failure.message : 'Could not update the claim.');
    } finally {
      working.current = false;
      if (isActiveSession(session.version)) setBusy(false);
    }
  }

  return {
    recovery, balances, operation, status, busy, error,
    paused: mutation.isPaused,
    canFinish: !!operation && isClaimReconciled(operation, balances.data),
    submit: (submission: TClaimSubmission) => run(async () => {
      if (!storageKey || !isActiveSession(session.version)) throw new Error('Claim recovery is not ready.');
      await executeClaimOperation(storageKey, {
        ...submission, idempotencyKey: crypto.randomUUID(), claim: null, rejection: null, errorMessage: null,
      }, mutation.mutateAsync, update);
    }),
    recover: () => run(async () => {
      if (!storageKey) throw new Error('Claim recovery is not ready.');
      await executeClaimOperation(storageKey, null, mutation.mutateAsync, update);
    }),
    finish: () => run(async () => {
      if (!storageKey) throw new Error('Claim recovery is not ready.');
      await finishClaimOperation(storageKey, balances.data);
      update(null);
    }),
  };
}
