import type { InternalAxiosRequestConfig } from 'axios';

export type TSessionRequestConfig = InternalAxiosRequestConfig & {
  authSessionVersion?: number;
};

export type TApiErrorDetails = {
  code: string;
  message: string;
  status?: number;
  field?: string;
  retryAfterMs?: number;
};
