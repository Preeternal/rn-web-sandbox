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
});
