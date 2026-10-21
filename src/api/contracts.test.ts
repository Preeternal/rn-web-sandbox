import { describe, expect, it } from 'vitest';

import { balancesResponseSchema } from './balances/balances.schemas';
import { claimSchema, createClaimRequestSchema } from './claims/claims.schemas';
import { decimalStringSchema } from './schemas';

describe('API decimal contracts', () => {
  it.each(['0', '0.00000001', '12', '9007199254740993.12345678'])('preserves %s exactly', (amount) => {
    expect(decimalStringSchema.parse(amount)).toBe(amount);
  });

  it.each(['.5', '1.', '05', '00.1', '1e-3', '-1', '+1', ' 1', '1 ', '1\n', 'NaN', '', 0.5])(
    'rejects a non-contract amount: %j',
    (amount) => expect(decimalStringSchema.safeParse(amount).success).toBe(false),
  );

  it.each(['0', '0.00', '-1', 'invalid', '.5'])('rejects an invalid outgoing claim without throwing: %s', (amount) => {
    expect(createClaimRequestSchema.safeParse({ asset: 'ETH', amount, destinationId: 'wallet' }).success).toBe(false);
  });

  it('rejects extra outgoing fields instead of silently changing the request body', () => {
    expect(createClaimRequestSchema.safeParse({
      asset: 'ETH', amount: '0.5', destinationId: 'wallet', unexpected: true,
    }).success).toBe(false);
  });

  it('validates asset precision independently from the USD price precision', () => {
    const snapshot = {
      asOf: '2026-10-21T08:00:00.000Z',
      items: [{ asset: 'ETH', decimals: 2, available: '1.23', pending: '0', claiming: '0', usdPrice: '2000.1234' }],
    };
    expect(balancesResponseSchema.safeParse(snapshot).success).toBe(true);
    snapshot.items[0].available = '1.234';
    expect(balancesResponseSchema.safeParse(snapshot).success).toBe(false);
  });

  it('rejects invalid snapshot timestamps', () => {
    expect(balancesResponseSchema.safeParse({ asOf: 'yesterday', items: [] }).success).toBe(false);
  });
});

describe('Claim response monetary consistency', () => {
  const claim = {
    id: 'clm_test', asset: 'ETH', destinationId: 'wallet', status: 'pending', failureReason: null,
    createdAt: '2026-10-21T08:00:00.000Z', updatedAt: '2026-10-21T08:00:00.000Z',
  };

  it.each([
    ['1', '0.1', '0.9'],
    ['1.00', '0.10', '0.900'],
    ['0.000000000000000002', '0.000000000000000001', '0.000000000000000001'],
    ['9007199254740993.1', '0.01', '9007199254740993.09'],
    ['0.1', '0.1', '0'],
  ])('accepts exact equality for %s = %s + %s', (amount, fee, receiveAmount) => {
    expect(claimSchema.safeParse({ ...claim, amount, fee, receiveAmount }).success).toBe(true);
  });

  it.each(['pending', 'completed', 'failed'])('rejects inconsistent money on a %s Claim', (status) => {
    expect(claimSchema.safeParse({ ...claim, status, amount: '1', fee: '0.1', receiveAmount: '999' }).success).toBe(false);
  });

  it.each(['amount', 'fee', 'receiveAmount'])('reports malformed %s without throwing from Big', (field) => {
    expect(claimSchema.safeParse({ ...claim, amount: '1', fee: '0.1', receiveAmount: '0.9', [field]: 'invalid' }).success).toBe(false);
  });
});
