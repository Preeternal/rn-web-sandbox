import axios, { AxiosError, isAxiosError, isCancel, type InternalAxiosRequestConfig } from 'axios';

import { expireSession, getSession } from '../features/auth/session';

import { API_BASE_URL, API_TIMEOUT_MS } from './config';
import type { TSessionRequestConfig } from '../types/features/api';

function isApiRequest(config: InternalAxiosRequestConfig) {
  if (!API_BASE_URL) {
    throw new AxiosError('Configure EXPO_PUBLIC_BASE_URL before making API requests.', 'API_CONFIG', config);
  }
  const url = new URL(config.url ?? '', config.baseURL ?? API_BASE_URL);
  return url.origin === new URL(API_BASE_URL).origin;
}

export function setupAxios() {
  axios.defaults.baseURL = API_BASE_URL;
  axios.defaults.timeout = API_TIMEOUT_MS;

  const requestId = axios.interceptors.request.use(
    (config: TSessionRequestConfig) => {
      if (!isApiRequest(config)) return config;
      // Validate a candidate without activating it or expiring an existing session on 401.
      if (config.tokenValidation) return config;
      const session = getSession();
      if (!session.ready || !session.token || !session.signal) {
        throw new AxiosError('Enter an API token before making requests.', 'AUTH_REQUIRED', config);
      }
      config.headers.set('Authorization', `Bearer ${session.token}`);
      config.authSessionVersion = session.version;
      config.signal = config.signal
        ? AbortSignal.any([config.signal as AbortSignal, session.signal])
        : session.signal;
      return config;
    },
    (error: unknown) => {
      throw error;
    },
    // Capture the session when axios is called, before a token change can intervene.
    { synchronous: true },
  );

  const responseId = axios.interceptors.response.use(
    (response) => {
      if (__DEV__) {
        console.log(
          '[api]',
          response.config.method?.toUpperCase() ?? 'GET',
          response.status,
          response.config.url,
          response,
        );
      }
      return response;
    },
    (error: unknown) => {
      if (isAxiosError(error)) {
        const config = error.config as TSessionRequestConfig | undefined;
        if (__DEV__) {
          if (error.response) {
            console.warn(
              '[api] Error response:',
              config?.method?.toUpperCase() ?? 'GET',
              error.response.status,
              config?.url,
              error.response,
            );
          } else if (!isCancel(error)) {
            console.warn('[api] Network error:', {
              method: config?.method?.toUpperCase() ?? 'GET',
              url: config?.url,
              message: error.message,
              code: error.code,
            });
          }
        }
        if (error.response?.status === 401 && config?.authSessionVersion !== undefined) {
          expireSession(config.authSessionVersion);
        }
      }
      return Promise.reject(error);
    },
  );

  return () => {
    axios.interceptors.request.eject(requestId);
    axios.interceptors.response.eject(responseId);
  };
}
