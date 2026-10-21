import type { z } from 'zod';

import type { claimOptionsSchema, createClaimRequestSchema } from '../../api/claims/claims.schemas';

export type TClaimOptions = z.infer<typeof claimOptionsSchema>;
export type TCreateClaimRequest = z.infer<typeof createClaimRequestSchema>;

export type TCreateClaimVariables = {
  payload: TCreateClaimRequest;
  idempotencyKey: string;
};
