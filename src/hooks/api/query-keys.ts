export const apiQueryKeys = {
  balances: (version: number) => ['session', version, 'balances'] as const,
  claimOptions: (version: number, asset?: string) => ['session', version, 'claim-options', asset ?? null] as const,
  claim: (version: number, id?: string) => ['session', version, 'claims', id ?? null] as const,
  createClaim: (version: number) => ['session', version, 'create-claim'] as const,
};
