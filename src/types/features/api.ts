import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

export type TApiRequestConfig = AxiosRequestConfig & { tokenValidation?: boolean };

export type TSessionRequestConfig = InternalAxiosRequestConfig & Pick<TApiRequestConfig, 'tokenValidation'> & {
  authSessionVersion?: number;
};

export type TApiErrorDetails = {
  code: string;
  message: string;
  status?: number;
  field?: string;
  retryAfterMs?: number;
};
