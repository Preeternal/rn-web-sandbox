import { z } from 'zod';

import { claimSchema, createClaimRequestSchema, idempotencyKeySchema } from '../../api/claims/claims.schemas';
import { decimalStringSchema } from '../../api/schemas';

export const claimSubmissionSchema = z.object({
  payload: createClaimRequestSchema,
  fee: decimalStringSchema,
  receiveAmount: decimalStringSchema,
  destinationLabel: z.string().min(1),
});

export const claimOperationSchema = claimSubmissionSchema.extend({
  idempotencyKey: idempotencyKeySchema,
  claim: claimSchema.nullable(),
  rejection: z.string().nullable(),
  errorMessage: z.string().nullable(),
}).refine((operation) => operation.claim === null || operation.rejection === null,
  'An operation cannot be both accepted and rejected.');
