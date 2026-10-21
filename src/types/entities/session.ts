export type TSession = {
  ready: boolean;
  token: string | null;
  version: number;
  notice: string | null;
  signal: AbortSignal | null;
};
