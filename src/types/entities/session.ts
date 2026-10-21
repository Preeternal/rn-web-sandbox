import type { TBalancesResponse } from '../features/balances';

export type TSession = {
  ready: boolean;
  token: string | null;
  version: number;
  notice: string | null;
  signal: AbortSignal | null;
  initialBalances?: { data: TBalancesResponse; updatedAt: number };
};
