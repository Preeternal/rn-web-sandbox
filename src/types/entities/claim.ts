import type { z } from 'zod';

import type { claimSchema, destinationSchema } from '../../api/claims/claims.schemas';

export type TClaim = z.infer<typeof claimSchema>;
export type TDestination = z.infer<typeof destinationSchema>;
