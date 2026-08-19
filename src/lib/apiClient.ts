import { getFirebaseAuth } from './firebase';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/env';

/**
 * Reusable HTTP client for the Node backend.
 *
 * Ported from `bingo/src/lib/apiClient.ts` — same contract, same error shape.
 * Firebase owns the session, so this client just attaches a fresh Firebase ID
 * token as the Bearer credential (Firebase caches and auto-refreshes it). On a
 * 401 it forces one token refresh and retries once. All failures normalize to a
 * typed {@link ApiError}.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the Bearer token (default true). */
  auth?: boolean;
  /** Force-refresh the token and retry once on 401 (default true). */
  retryOn401?: boolean;
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, string> };
}

/** A fresh Firebase ID token, or null when signed out. */
async function idToken(forceRefresh = false): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

async function rawFetch(
  path: string,
  options: RequestOptions,
  forceRefresh = false,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (options.auth !== false) {
    const token = await idToken(forceRefresh);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // Network failure, DNS error, blocked by CORS, or timeout abort.
    throw new ApiError(0, 'network', 'Network error. Please check your connection.');
  } finally {
    clearTimeout(timeout);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as T & ErrorBody;
  if (!res.ok) {
    const err = json.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? 'unknown',
      err.message ?? 'Something went wrong. Please try again.',
      err.details,
    );
  }
  return json;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawFetch(path, options);

  const canRetry =
    res.status === 401 &&
    options.retryOn401 !== false &&
    options.auth !== false &&
    getFirebaseAuth().currentUser !== null;

  if (canRetry) {
    // A stale cached token — force-refresh and retry once.
    res = await rawFetch(path, options, true);
  }

  return parse<T>(res);
}

export const apiClient = {
  /** Fresh Firebase ID token (e.g. for the Socket.IO handshake). Null when signed out. */
  getIdToken: idToken,
  request,
};
