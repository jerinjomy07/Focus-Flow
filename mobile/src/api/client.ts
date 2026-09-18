// mobile/src/api/client.ts
// FocusFlow Mobile — Typed REST API Client with Automatic Token Rotation
//
// Manages short-lived access tokens in memory and rotating refresh tokens
// strictly within hardware-backed expo-secure-store. Intercepts 401 errors
// to automatically rotate refresh tokens and retry the original request.

import * as SecureStore from 'expo-secure-store';
import { APIError } from '../types';

export const REFRESH_TOKEN_STORAGE_KEY = 'focusflow_refresh_token';

// Base URL resolution: honors EXPO_PUBLIC_API_URL, falling back to local reverse proxy
export const getBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
};

export class ApiClientError extends Error {
  code: string;
  statusCode: number;
  details?: Array<{ field: string; issue: string }>;

  constructor(code: string, message: string, statusCode: number, details?: Array<{ field: string; issue: string }>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// In-memory short-lived access token — never persisted to plain storage or disk
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

async function performTokenRefresh(): Promise<string | null> {
  try {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
    if (!refreshToken) {
      return null;
    }

    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/auth/mobile/refresh`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(() => {});
      inMemoryAccessToken = null;
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.data.accessToken;
    const newRefreshToken = data.data.refreshToken;

    inMemoryAccessToken = newAccessToken;
    await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, newRefreshToken);

    return newAccessToken;
  } catch {
    return null;
  }
}

async function request<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
  options: RequestOptions = {},
  isRetry = false
): Promise<T> {
  const baseUrl = getBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Inject in-memory access token
  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const timeoutMs = options.timeoutMs || 15_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    // Handle 401 Unauthorized with automatic refresh token rotation
    if (response.status === 401 && !isRetry && !endpoint.includes('/auth/mobile/login') && !endpoint.includes('/auth/mobile/refresh')) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await performTokenRefresh();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);
          return request<T>(endpoint, method, body, options, true);
        } else {
          if (unauthorizedHandler) {
            unauthorizedHandler();
          }
        }
      } else {
        // Wait for current refresh to complete
        const retryPromise = new Promise<T>((resolve, reject) => {
          refreshSubscribers.push((newToken: string) => {
            request<T>(endpoint, method, body, options, true).then(resolve).catch(reject);
          });
        });
        return retryPromise;
      }
    }

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorPayload: APIError = json?.error || {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'An unexpected server error occurred',
      };

      if (response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
      }

      throw new ApiClientError(
        errorPayload.code,
        errorPayload.message,
        response.status,
        errorPayload.details
      );
    }

    return json.data !== undefined ? (json.data as T) : (json as T);
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiClientError) {
      throw err;
    }

    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiClientError('TIMEOUT', 'The request timed out. Please check your network connection.', 408);
    }

    throw new ApiClientError(
      'NETWORK_ERROR',
      'Unable to connect to the FocusFlow server. Please check your internet connection.',
      0
    );
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, 'GET', undefined, options),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => request<T>(endpoint, 'POST', body, options),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => request<T>(endpoint, 'PATCH', body, options),
  delete: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, 'DELETE', undefined, options),
};
