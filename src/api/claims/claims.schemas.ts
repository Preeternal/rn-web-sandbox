import { Big } from 'big.js';
import { z } from 'zod';

import { decimalStringSchema, identifierSchema, positiveDecimalStringSchema } from '../schemas';

export const destinationSchema = z.object({
  id: identifierSchema,
  label: z.string().min(1),
});

export const claimOptionsSchema = z.object({
  asset: identifierSchema,
  minAmount: decimalStringSchema,
  fee: decimalStringSchema,
  destinations: z.array(destinationSchema),
});

export const createClaimRequestSchema = z.strictObject({
  asset: identifierSchema,
  amount: positiveDecimalStringSchema,
  destinationId: identifierSchema,
});

export const idempotencyKeySchema = z.string().min(1).max(100);

export const claimSchema = z.object({
  id: identifierSchema,
  asset: identifierSchema,
  amount: positiveDecimalStringSchema,
  fee: decimalStringSchema,
  receiveAmount: decimalStringSchema,
  destinationId: identifierSchema,
  status: z.enum(['pending', 'completed', 'failed']),
  failureReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).superRefine((claim, context) => {
  // Format checks may already have failed without stopping refinements.
  if ([claim.amount, claim.fee, claim.receiveAmount].some((value) => !decimalStringSchema.safeParse(value).success)) return;
  if (!new Big(claim.amount).eq(new Big(claim.fee).plus(claim.receiveAmount))) {
    context.addIssue({ code: 'custom', path: ['receiveAmount'], message: 'Claim amount must equal fee plus receive amount.' });
  }
});
