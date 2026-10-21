import { Big } from 'big.js';
import { z } from 'zod';

// The final assertion rejects trailing newlines as well as other extra characters.
export const decimalStringSchema = z.string().regex(
  /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?![\s\S])/,
  'Expected a non-negative decimal string without leading zeros.',
);

export const positiveDecimalStringSchema = decimalStringSchema.pipe(z.string().refine(
  (value) => new Big(value).gt(0),
  'Amount must be greater than zero.',
));

export const identifierSchema = z.string().min(1);

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    field: z.string().optional(),
    retryAfterMs: z.number().nonnegative().optional(),
  }),
});
