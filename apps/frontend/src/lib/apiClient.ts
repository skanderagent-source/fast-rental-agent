import { supabase } from './supabaseClient';
import { env } from './env';

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
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthHeader();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = token;

  const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? 'REQUEST_FAILED',
      json?.error?.message ?? 'Request failed',
    );
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  uploadFile: async <T>(path: string, file: File): Promise<T> => {
    const token = await getAuthHeader();
    const headers: Record<string, string> = { 'Content-Type': file.type || 'application/octet-stream' };
    if (token) headers.Authorization = token;
    const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, { method: 'PUT', body: file, headers });
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
