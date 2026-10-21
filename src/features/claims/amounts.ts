import { Big } from 'big.js';

import { decimalStringSchema } from '../../api/schemas';
import type { TBalance } from '../../types/entities/balance';
import type { TClaimAmountValidation, TClaimOptions } from '../../types/features/claims';

export function getMaxClaimAmount(balance: TBalance): string {
  // The server deducts the fee from the claimed amount, not on top of it.
  return balance.available;
}

// Balance and options are already validated at the API boundary. Input is raw form text.
export function validateClaimAmount(
  input: string,
  balance: TBalance,
  options: TClaimOptions,
): TClaimAmountValidation {
  if (balance.asset !== options.asset) {
    return { valid: false, code: 'ASSET_MISMATCH', message: 'Claim options do not match the selected asset.' };
  }
  if (!input) return { valid: false, code: 'REQUIRED', message: 'Enter an amount.' };
  if (!decimalStringSchema.safeParse(input).success) {
    return { valid: false, code: 'INVALID_FORMAT', message: 'Enter digits with an optional decimal point, without leading zeros.' };
  }

  const amount = new Big(input);
  if (amount.lte(0)) {
    return { valid: false, code: 'NOT_POSITIVE', message: 'Amount must be greater than zero.' };
  }
  if ((input.split('.')[1]?.length ?? 0) > balance.decimals) {
    return { valid: false, code: 'EXCESS_PRECISION', message: `Use at most ${balance.decimals} decimal places.` };
  }
  if (amount.lt(options.minAmount)) {
    return { valid: false, code: 'BELOW_MINIMUM', message: `Minimum amount is ${options.minAmount} ${balance.asset}.` };
  }
  if (amount.gt(balance.available)) {
    return { valid: false, code: 'ABOVE_AVAILABLE', message: 'Amount exceeds the available balance.' };
  }

  const receiveAmount = amount.minus(options.fee);
  if (receiveAmount.lt(0)) {
    return { valid: false, code: 'FEE_EXCEEDS_AMOUNT', message: 'The fee exceeds the claim amount.' };
  }

  return {
    valid: true,
    amount: input,
    fee: options.fee,
    // No rounding or exponential notation in values used for confirmation.
    receiveAmount: receiveAmount.toFixed(),
  };
}
