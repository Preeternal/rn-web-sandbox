import { Big } from 'big.js';

import type { TClaim } from '../../types/entities/claim';
import type { TClaimOptions, TCreateClaimRequest } from '../../types/features/claims';

import { requestApi, validateRequest } from '../request';
import { decimalStringSchema, identifierSchema } from '../schemas';
import {
  claimOptionsSchema,
  claimSchema,
  createClaimRequestSchema,
  idempotencyKeySchema,
} from './claims.schemas';

export async function fetchClaimOptions(asset: string, signal?: AbortSignal): Promise<TClaimOptions> {
  const validatedAsset = validateRequest(identifierSchema, asset);
  return requestApi(
    { method: 'GET', url: '/v1/claim-options', params: { asset: validatedAsset }, signal },
    claimOptionsSchema.refine((options) => options.asset === validatedAsset),
  );
}

export async function createClaim(payload: TCreateClaimRequest, idempotencyKey: string): Promise<TClaim> {
  const body = validateRequest(createClaimRequestSchema, payload);
  const key = validateRequest(idempotencyKeySchema, idempotencyKey);
  // The caller owns key generation/persistence. Never generate a new key or retry here.
  return requestApi(
    { method: 'POST', url: '/v1/claims', data: body, headers: { 'Idempotency-Key': key } },
    claimSchema.refine((claim) => claim.asset === body.asset
      && claim.destinationId === body.destinationId
      && decimalStringSchema.safeParse(claim.amount).success
      && new Big(claim.amount).eq(body.amount)),
  );
}

export async function fetchClaim(id: string, signal?: AbortSignal): Promise<TClaim> {
  const claimId = validateRequest(identifierSchema, id);
  return requestApi(
    { method: 'GET', url: `/v1/claims/${encodeURIComponent(claimId)}`, signal },
    claimSchema.refine((claim) => claim.id === claimId),
  );
}
