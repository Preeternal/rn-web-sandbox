import { AxiosHeaders, isAxiosError } from 'axios';

import type { TApiErrorDetails } from '../types/features/api';

import { apiErrorResponseSchema } from './schemas';

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly field?: string;
  readonly retryAfterMs?: number;

  constructor(details: TApiErrorDetails) {
    super(details.message);
    this.name = 'ApiError';
    this.code = details.code;
    this.status = details.status;
    this.field = details.field;
    this.retryAfterMs = details.retryAfterMs;
  }
}

function retryDelay(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const text = String(value).trim();
  if (!text) return;
  const seconds = Number(text);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : undefined;
  const timestamp = Date.parse(text);
  if (Number.isFinite(timestamp)) return Math.max(0, timestamp - Date.now());
}

function httpErrorCode(status: number) {
  switch (status) {
    case 400: return 'VALIDATION';
    case 401: return 'UNAUTHORIZED';
    case 404: return 'NOT_FOUND';
    case 409: return 'IDEMPOTENCY_MISMATCH';
    case 429: return 'RATE_LIMITED';
    case 504: return 'TIMEOUT';
    default: return status >= 500 ? 'SERVER' : 'HTTP_ERROR';
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!isAxiosError(error)) {
    return new ApiError({ code: 'UNKNOWN', message: 'An unexpected API error occurred.' });
  }

  if (error.response) {
    const { status, data, headers } = error.response;
    const parsed = apiErrorResponseSchema.safeParse(data);
    const details = parsed.success ? parsed.data.error : undefined;
    const retryAfter = headers instanceof AxiosHeaders
      ? headers.get('retry-after')
      : headers['retry-after'] ?? headers['Retry-After'];
    return new ApiError({
      status,
      code: details?.code ?? httpErrorCode(status),
      message: details?.message ?? `API request failed (HTTP ${status}).`,
      field: details?.field,
      retryAfterMs: details?.retryAfterMs ?? retryDelay(retryAfter),
    });
  }

  if (error.code === 'AUTH_REQUIRED') {
    return new ApiError({ code: 'AUTH_REQUIRED', message: 'Enter an API token before making requests.' });
  }
  const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
  return new ApiError({
    code: timedOut ? 'TIMEOUT' : 'NETWORK',
    message: timedOut ? 'The API request timed out.' : 'Could not reach the API.',
  });
}
