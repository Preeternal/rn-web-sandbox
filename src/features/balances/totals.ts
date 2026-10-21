import { Big } from 'big.js';

import type { TBalance } from '../../types/entities/balance';
import type { TBalanceUsdTotals } from '../../types/features/balances';

// Total payback includes pending and in-progress amounts; available is returned separately.
export function calculateBalanceUsdTotals(balances: readonly TBalance[]): TBalanceUsdTotals {
  let available = new Big('0');
  let pending = new Big('0');
  let claiming = new Big('0');

  for (const balance of balances) {
    const price = new Big(balance.usdPrice);
    available = available.plus(new Big(balance.available).times(price));
    pending = pending.plus(new Big(balance.pending).times(price));
    claiming = claiming.plus(new Big(balance.claiming).times(price));
  }

  // Keep exact values. Display formatting must not feed back into financial logic.
  return {
    availableUsd: available.toFixed(),
    pendingUsd: pending.toFixed(),
    claimingUsd: claiming.toFixed(),
    totalUsd: available.plus(pending).plus(claiming).toFixed(),
  };
}
