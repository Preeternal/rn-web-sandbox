import type { z } from 'zod';

import type { claimOptionsSchema, createClaimRequestSchema } from '../../api/claims/claims.schemas';

export type TClaimOptions = z.infer<typeof claimOptionsSchema>;
export type TCreateClaimRequest = z.infer<typeof createClaimRequestSchema>;

export type TCreateClaimVariables = {
  payload: TCreateClaimRequest;
  idempotencyKey: string;
};

export type TClaimAmountErrorCode =
  | 'REQUIRED'
  | 'INVALID_FORMAT'
  | 'NOT_POSITIVE'
  | 'EXCESS_PRECISION'
  | 'BELOW_MINIMUM'
  | 'ABOVE_AVAILABLE'
  | 'FEE_EXCEEDS_AMOUNT'
  | 'ASSET_MISMATCH';

export type TClaimAmountValidation =
  | { valid: false; code: TClaimAmountErrorCode; message: string }
  | { valid: true; amount: string; fee: string; receiveAmount: string };
