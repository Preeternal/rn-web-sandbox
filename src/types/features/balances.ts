import type { z } from 'zod';

import type { balancesResponseSchema } from '../../api/balances/balances.schemas';

export type TBalancesResponse = z.infer<typeof balancesResponseSchema>;

export type TBalanceUsdTotals = {
  availableUsd: string;
  pendingUsd: string;
  claimingUsd: string;
  totalUsd: string;
};
