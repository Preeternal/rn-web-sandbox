import { describe, expect, it } from 'vitest';

import type { TBalance } from '../../types/entities/balance';
import type { TClaimOptions } from '../../types/features/claims';

import { getMaxClaimAmount, validateClaimAmount } from './amounts';

const balance: TBalance = {
  asset: 'ETH', decimals: 8, available: '0.5', pending: '1', claiming: '0.2', usdPrice: '2000',
};
const options: TClaimOptions = {
  asset: 'ETH', minAmount: '0.01', fee: '0.0012', destinations: [{ id: 'wallet', label: 'Wallet' }],
};

describe('Claim amount validation', () => {
  it.each(['.5', '1.', '05', '00.1', '1e-3', '-1', '+1', 'NaN', 'Infinity', ' 0.1', '0.1 ', '0.1\n', '0,1'])(
    'rejects malformed input without normalizing it: %j',
    (input) => expect(validateClaimAmount(input, balance, options)).toMatchObject({ valid: false, code: 'INVALID_FORMAT' }),
  );

  it.each([
    ['', 'REQUIRED'],
    ['0', 'NOT_POSITIVE'],
    ['0.00000000', 'NOT_POSITIVE'],
    ['0.010000001', 'EXCESS_PRECISION'],
    ['0.00999999', 'BELOW_MINIMUM'],
    ['0.50000001', 'ABOVE_AVAILABLE'],
  ])('reports the appropriate error for %j', (input, code) => {
    expect(validateClaimAmount(input, balance, options)).toMatchObject({ valid: false, code });
  });

  it('accepts the exact minimum and subtracts the fixed API fee', () => {
    expect(validateClaimAmount('0.01', balance, options)).toEqual({
      valid: true, amount: '0.01', fee: '0.0012', receiveAmount: '0.0088',
    });
  });

  it('uses the entire available amount for Max, excluding pending and claiming funds', () => {
    expect(validateClaimAmount(getMaxClaimAmount(balance), balance, options)).toEqual({
      valid: true, amount: '0.5', fee: '0.0012', receiveAmount: '0.4988',
    });
  });

  it('does not treat Max as valid when available is below the minimum', () => {
    const smallBalance = { ...balance, available: '0.009' };
    expect(validateClaimAmount(getMaxClaimAmount(smallBalance), smallBalance, options)).toMatchObject({
      valid: false, code: 'BELOW_MINIMUM',
    });
  });

  it('rejects a claim from a zero available balance', () => {
    const emptyBalance = { ...balance, available: '0' };
    expect(validateClaimAmount(getMaxClaimAmount(emptyBalance), emptyBalance, options)).toMatchObject({ valid: false });
    expect(validateClaimAmount('0.01', emptyBalance, options)).toMatchObject({ valid: false, code: 'ABOVE_AVAILABLE' });
  });

  it('counts trailing zeros toward the documented asset precision', () => {
    const integerBalance = { ...balance, decimals: 0, available: '10' };
    const integerOptions = { ...options, minAmount: '1', fee: '0' };
    expect(validateClaimAmount('1', integerBalance, integerOptions)).toMatchObject({ valid: true });
    expect(validateClaimAmount('1.0', integerBalance, integerOptions)).toMatchObject({ valid: false, code: 'EXCESS_PRECISION' });
  });

  it('preserves the entered amount for the request and calculates an exact net amount', () => {
    expect(validateClaimAmount('0.10000000', balance, options)).toEqual({
      valid: true, amount: '0.10000000', fee: '0.0012', receiveAmount: '0.0988',
    });
  });

  it('rejects a negative receive amount without rounding the fee', () => {
    expect(validateClaimAmount('0.01', balance, { ...options, fee: '0.01000001' })).toMatchObject({
      valid: false, code: 'FEE_EXCEEDS_AMOUNT',
    });
  });

  it('allows a zero receive amount because the contract does not prohibit it', () => {
    expect(validateClaimAmount('0.01', balance, { ...options, fee: '0.01' })).toMatchObject({
      valid: true, receiveAmount: '0',
    });
  });

  it('preserves precision beyond JavaScript safe integers', () => {
    expect(validateClaimAmount('9007199254740993.1', {
      ...balance, available: '9007199254740993.2',
    }, { ...options, fee: '0.01' })).toMatchObject({
      valid: true, receiveAmount: '9007199254740993.09',
    });
  });

  it('supports 18-decimal assets without exponential notation or rounding', () => {
    expect(validateClaimAmount('0.000000000000000002', {
      ...balance, decimals: 18, available: '0.000000000000000002',
    }, { ...options, minAmount: '0.000000000000000001', fee: '0.000000000000000001' })).toEqual({
      valid: true, amount: '0.000000000000000002', fee: '0.000000000000000001', receiveAmount: '0.000000000000000001',
    });
  });

  it('does not apply options for a previously selected asset', () => {
    expect(validateClaimAmount('0.1', balance, { ...options, asset: 'BTC' })).toMatchObject({
      valid: false, code: 'ASSET_MISMATCH',
    });
  });
});
