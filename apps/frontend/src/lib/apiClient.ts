// API calls use explicit Bearer auth with credentials: 'omit' (no cookie/CSRF surface).
// CORS is enforced server-side against FRONTEND_ORIGIN.
import { resolveAccessToken } from './supabaseClient';
import { env } from './env';
import { getApiAbortSignal } from './authSession';
import type { SensitiveAction } from '@fast-rental/shared';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function getAuthHeader() {
  const token = await resolveAccessToken();
  return token ? `Bearer ${token}` : null;
}

type RequestOptions = RequestInit & {
  /** Keep auth bootstrap requests alive through session cleanup races (e.g. login). */
  skipSessionAbort?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipSessionAbort, ...fetchOptions } = options;
  const token = await getAuthHeader();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = token;

  try {
    const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'omit',
      signal: fetchOptions.signal ?? (skipSessionAbort ? undefined : getApiAbortSignal()),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(
        res.status,
        json?.error?.code ?? 'REQUEST_FAILED',
        json?.error?.message ?? 'Request failed',
      );
    }
    return json.data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'REQUEST_ABORTED', 'Request cancelled');
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), ...options }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}), ...options }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}), ...options }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { method: 'DELETE', ...options }),
  uploadFile: async <T>(path: string, file: File): Promise<T> => {
    const token = await getAuthHeader();
    const headers: Record<string, string> = { 'Content-Type': file.type || 'application/octet-stream' };
    if (token) headers.Authorization = token;
    const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
      method: 'PUT',
      body: file,
      headers,
      credentials: 'omit',
      signal: getApiAbortSignal(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        res.status,
        json?.error?.code ?? 'REQUEST_FAILED',
        json?.error?.message ?? 'Upload failed',
      );
    }
    return json.data as T;
  },
};

async function issueActionToken(action: SensitiveAction, targetId?: string) {
  return request<{ token: string; expiresAt: string }>('/api/me/action-token', {
    method: 'POST',
    body: JSON.stringify({ action, ...(targetId ? { targetId } : {}) }),
  });
}

async function actionHeaders(action: SensitiveAction, targetId?: string) {
  const { token } = await issueActionToken(action, targetId);
  return { 'X-Action-Token': token };
}

export const sensitiveApi = {
  delete: async <T>(path: string, action: SensitiveAction, targetId: string) =>
    request<T>(path, {
      method: 'DELETE',
      headers: await actionHeaders(action, targetId),
    }),
  post: async <T>(path: string, action: SensitiveAction, targetId?: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: await actionHeaders(action, targetId),
      body: JSON.stringify(body ?? {}),
    }),
  patch: async <T>(path: string, action: SensitiveAction, targetId: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      headers: await actionHeaders(action, targetId),
      body: JSON.stringify(body),
    }),
};
