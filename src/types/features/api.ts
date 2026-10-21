import type { InternalAxiosRequestConfig } from 'axios';

export type TSessionRequestConfig = InternalAxiosRequestConfig & {
  authSessionVersion?: number;
};
