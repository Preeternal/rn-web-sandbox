import type { z } from 'zod';

import type { balanceSchema } from '../../api/balances/balances.schemas';

export type TBalance = z.infer<typeof balanceSchema>;
