import type { ApiResponse, AuthTokens } from '@bulk/shared';
import { session } from './session-port';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Error thrown by the API client on any non-success envelope. Carries the
 * machine-readable backend error `code` so callers can map it to a friendly
 * message.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the Bearer access token. Default true. Set false for auth endpoints. */
  auth?: boolean;
}

/**
 * A single in-flight refresh shared by all callers (stampede guard): if a
 * refresh is already running, concurrent 401s await the same promise instead
 * of each firing their own /auth/refresh.
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Perform one refresh using the stored refresh token. Uses raw fetch (NOT the
 * instrumented request path) so a 401 here can never re-enter the refresh flow
 * — this, plus the single-retry guard below, prevents infinite refresh loops.
 * On success the rotated tokens are stored and the new access token returned;
 * on any failure the session is cleared (logged-out state) and null returned.
 */
async function doRefresh(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = session();
  const token = refreshToken();
  if (!token) {
    logout();
    return null;
  }
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    const parsed = (await response.json()) as ApiResponse<AuthTokens>;
    if (!response.ok || !parsed.success) {
      logout();
      return null;
    }
    setTokens(parsed.data);
    return parsed.data.accessToken;
  } catch {
    logout();
    return null;
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function execute<T>(
  path: string,
  method: NonNullable<RequestOptions['method']>,
  body: unknown,
  auth: boolean,
  isRetry: boolean,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const accessToken = auth ? session().accessToken() : null;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let parsed: ApiResponse<T>;
  try {
    parsed = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('INTERNAL_ERROR', 'Unexpected response from the server.', response.status);
  }

  if (response.ok && parsed.success) {
    return parsed.data;
  }

  const code = parsed.success === false ? parsed.error.code : 'INTERNAL_ERROR';
  const message = parsed.success === false ? parsed.error.message : 'Request failed.';

  // Transparent refresh on an expired access token: only for authed requests,
  // only once (isRetry guard), and only when a refresh token exists.
  if (response.status === 401 && auth && !isRetry && session().refreshToken()) {
    const newAccessToken = await refreshOnce();
    if (newAccessToken) {
      return execute<T>(path, method, body, auth, true);
    }
  }

  throw new ApiError(code, message, response.status);
}

/** Typed API client: attaches the Bearer token, parses the standard envelope. */
export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  return execute<T>(path, method, body, auth, false);
}
