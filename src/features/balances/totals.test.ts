import { describe, expect, it } from 'vitest';

import type { TBalance } from '../../types/entities/balance';

import { calculateBalanceUsdTotals } from './totals';

describe('balance USD totals', () => {
  it('returns zero totals for an empty balance list', () => {
    expect(calculateBalanceUsdTotals([])).toEqual({
      availableUsd: '0', pendingUsd: '0', claimingUsd: '0', totalUsd: '0',
    });
  });

  it('adds multiple assets and keeps available, pending, and claiming values separate', () => {
    expect(calculateBalanceUsdTotals([
      { asset: 'A', decimals: 1, available: '0.1', pending: '0.2', claiming: '0.3', usdPrice: '0.2' },
      { asset: 'B', decimals: 0, available: '1', pending: '2', claiming: '3', usdPrice: '0.1' },
    ])).toEqual({ availableUsd: '0.12', pendingUsd: '0.24', claimingUsd: '0.36', totalUsd: '0.72' });
  });

  it('uses all USD price digits and retains sub-cent values', () => {
    expect(calculateBalanceUsdTotals([
      { asset: 'BTC', decimals: 8, available: '0.00000001', pending: '0', claiming: '0', usdPrice: '60000.12345678' },
    ])).toEqual({ availableUsd: '0.0006000012345678', pendingUsd: '0', claimingUsd: '0', totalUsd: '0.0006000012345678' });
  });

  it('does not lose precision when summing values beyond safe integers', () => {
    const balances: TBalance[] = [
      { asset: 'A', decimals: 1, available: '9007199254740993.1', pending: '0', claiming: '0', usdPrice: '1' },
      { asset: 'B', decimals: 1, available: '0.2', pending: '0', claiming: '0', usdPrice: '1' },
    ];
    expect(calculateBalanceUsdTotals(balances).totalUsd).toBe('9007199254740993.3');
  });

  it('keeps a transfer from available to claiming neutral in the total', () => {
    const balance: TBalance = { asset: 'ETH', decimals: 1, available: '1', pending: '0', claiming: '0', usdPrice: '2000' };
    const before = calculateBalanceUsdTotals([balance]);
    const after = calculateBalanceUsdTotals([{ ...balance, available: '0.5', claiming: '0.5' }]);
    expect(after.totalUsd).toBe(before.totalUsd);
    expect(after.availableUsd).toBe('1000');
    expect(after.claimingUsd).toBe('1000');
    expect(balance.available).toBe('1');
  });

  it('handles zero prices without introducing NaN or changing the snapshot', () => {
    const balance: TBalance = Object.freeze({ asset: 'A', decimals: 0, available: '10', pending: '2', claiming: '1', usdPrice: '0' });
    expect(calculateBalanceUsdTotals(Object.freeze([balance]))).toEqual({
      availableUsd: '0', pendingUsd: '0', claimingUsd: '0', totalUsd: '0',
    });
  });
});
