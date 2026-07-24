const AUTH_CALLBACK_ERROR_KEY = 'fast-rental:auth-callback-error';

export type AuthCallbackError = { code: string; description: string };

/** Read and clear Supabase auth errors from the URL (expired/invalid email links). */
export function consumeAuthCallbackError(): AuthCallbackError | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const error = hashParams.get('error') ?? queryParams.get('error');
  if (!error) return null;

  const code = hashParams.get('error_code') ?? queryParams.get('error_code') ?? error;
  const rawDescription = hashParams.get('error_description') ?? queryParams.get('error_description') ?? '';
  const description = decodeURIComponent(rawDescription.replace(/\+/g, ' '));

  const nextQuery = new URLSearchParams(window.location.search);
  nextQuery.delete('error');
  nextQuery.delete('error_code');
  nextQuery.delete('error_description');
  const qs = nextQuery.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);

  return { code, description };
}

/** Persist callback error before the Supabase client boots (detectSessionInUrl). */
export function stashAuthCallbackError(error: AuthCallbackError): void {
  sessionStorage.setItem(AUTH_CALLBACK_ERROR_KEY, JSON.stringify(error));
}

export function takeStashedAuthCallbackError(): AuthCallbackError | null {
  const raw = sessionStorage.getItem(AUTH_CALLBACK_ERROR_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(AUTH_CALLBACK_ERROR_KEY);
  try {
    return JSON.parse(raw) as AuthCallbackError;
  } catch {
    return null;
  }
}

export function authCallbackErrorRedirect(code: string): string {
  if (code === 'otp_expired' || code === 'access_denied') {
    return '/auth/forgot-password?error=otp_expired';
  }
  return `/agent-login?error=${encodeURIComponent(code)}`;
}
