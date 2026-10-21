import { z } from 'zod';

import { decimalStringSchema, identifierSchema } from '../schemas';

export const balanceSchema = z.object({
  asset: identifierSchema,
  decimals: z.number().int().nonnegative(),
  available: decimalStringSchema,
  pending: decimalStringSchema,
  claiming: decimalStringSchema,
  usdPrice: decimalStringSchema,
}).superRefine((balance, context) => {
  for (const field of ['available', 'pending', 'claiming'] as const) {
    if ((balance[field].split('.')[1]?.length ?? 0) > balance.decimals) {
      context.addIssue({ code: 'custom', path: [field], message: 'Amount exceeds asset precision.' });
    }
  }
});

export const balancesResponseSchema = z.object({
  asOf: z.iso.datetime(),
  items: z.array(balanceSchema),
});
