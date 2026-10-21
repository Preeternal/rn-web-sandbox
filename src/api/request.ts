import axios, { isCancel } from 'axios';
import type { z } from 'zod';

import type { TApiRequestConfig } from '../types/features/api';

import { ApiError, normalizeApiError } from './errors';

export function validateRequest<TData>(schema: z.ZodType<TData>, value: unknown): TData {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError({
      code: 'CLIENT_VALIDATION',
      message: issue?.message ?? 'Invalid request data.',
      field: issue?.path.length ? issue.path.join('.') : undefined,
    });
  }
  return result.data;
}

export async function requestApi<TData>(
  config: TApiRequestConfig,
  schema: z.ZodType<TData>,
): Promise<TData> {
  try {
    const response = await axios.request<unknown>(config);
    const result = schema.safeParse(response.data);
    if (!result.success) {
      // A malformed successful POST response does not imply the operation failed.
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'The API returned an invalid response.',
        status: response.status,
      });
    }
    return result.data;
  } catch (error) {
    // Preserve Axios cancellation so query cancellation remains distinguishable.
    if (isCancel(error)) throw error;
    throw normalizeApiError(error);
  }
}
