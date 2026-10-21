import { describe, expect, it } from 'vitest';

import { balancesResponseSchema } from './balances/balances.schemas';
import { createClaimRequestSchema } from './claims/claims.schemas';
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
