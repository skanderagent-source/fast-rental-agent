import { supabase } from '../../lib/supabaseClient';

export async function requestPasswordReset(email: string, redirectTo: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function hasRecoveryAuthenticator(): Promise<boolean> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return false;
  const claims = data.claims as { amr?: Array<{ method?: string }> };
  return claims.amr?.some((entry) => entry.method === 'recovery') ?? false;
}

function authLinkTypeFromUrl(): string | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  return hashParams.get('type') ?? queryParams.get('type');
}

export {
  consumeAuthCallbackError,
  authCallbackErrorRedirect,
} from '../../lib/authCallbackUrl';

/** True while Supabase may still be exchanging hash/query tokens into a session. */
export function hasAuthCallbackParams(): boolean {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  return Boolean(
    hashParams.get('access_token')
    || hashParams.get('refresh_token')
    || hashParams.get('type')
    || queryParams.get('code')
    || queryParams.get('token_hash')
    || queryParams.get('type'),
  );
}

function rememberAuthLinkIntent(kind: 'invite' | 'recovery') {
  if (authLinkTypeFromUrl() === kind) {
    sessionStorage.setItem(`fast-rental:${kind}-pending`, '1');
  }
}

function hasAuthLinkIntent(kind: 'invite' | 'recovery'): boolean {
  return sessionStorage.getItem(`fast-rental:${kind}-pending`) === '1'
    || authLinkTypeFromUrl() === kind;
}

function clearAuthLinkIntent(kind: 'invite' | 'recovery') {
  sessionStorage.removeItem(`fast-rental:${kind}-pending`);
}

/** Capture invite intent before Supabase strips hash tokens from the URL. */
export function rememberInviteLinkIntent() {
  rememberAuthLinkIntent('invite');
}

export function rememberRecoveryLinkIntent() {
  rememberAuthLinkIntent('recovery');
}

export function consumeInviteLinkIntent(): boolean {
  const pending = hasAuthLinkIntent('invite');
  if (pending) clearAuthLinkIntent('invite');
  return pending;
}

export function consumeRecoveryLinkIntent(): boolean {
  const pending = hasAuthLinkIntent('recovery');
  if (pending) clearAuthLinkIntent('recovery');
  return pending;
}

type WaitOptions = {
  timeoutMs?: number;
  isReady: () => Promise<boolean>;
  onAuthEvent?: (event: string, session: unknown) => Promise<boolean> | boolean;
};

/**
 * Wait for an email auth callback without racing Supabase token exchange.
 * Subscribe first, then poll — never fail while callback params are still in the URL.
 */
async function waitForAuthCallback({
  timeoutMs = 20_000,
  isReady,
  onAuthEvent,
}: WaitOptions): Promise<boolean> {
  if (await isReady()) return true;

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (authorized: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      subscription.unsubscribe();
      resolve(authorized);
    };

    const scheduleTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Keep waiting while Supabase is still processing URL tokens.
        if (hasAuthCallbackParams()) {
          scheduleTimeout();
          return;
        }
        void isReady().then((ready) => finish(ready));
      }, timeoutMs);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      void (async () => {
        if (onAuthEvent && await onAuthEvent(event, session)) {
          finish(true);
          return;
        }
        if (await isReady()) finish(true);
      })();
    });

    const poll = setInterval(() => {
      void (async () => {
        if (await isReady()) finish(true);
      })();
    }, 150);

    scheduleTimeout();

    void (async () => {
      // Give detectSessionInUrl a moment, then check again.
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (settled) return;
        if (await isReady()) {
          finish(true);
          return;
        }
        await new Promise((delay) => setTimeout(delay, 100));
      }
    })();
  });
}

/** Wait for Supabase to finish consuming the invite link before validating it. */
export async function waitForInviteSession(timeoutMs = 20_000): Promise<boolean> {
  rememberInviteLinkIntent();

  return waitForAuthCallback({
    timeoutMs,
    isReady: async () => {
      const { data } = await supabase.auth.getSession();
      return Boolean(data.session);
    },
    onAuthEvent: (_event, session) => Boolean(session),
  });
}

/** Wait for Supabase to finish consuming the recovery link before validating it. */
export async function waitForRecoverySession(timeoutMs = 20_000): Promise<boolean> {
  rememberRecoveryLinkIntent();

  return waitForAuthCallback({
    timeoutMs,
    isReady: async () => {
      if (await hasRecoveryAuthenticator()) return true;
      // Fallback: recovery link intent + established session (claims can lag briefly).
      if (!hasAuthLinkIntent('recovery')) return false;
      const { data } = await supabase.auth.getSession();
      return Boolean(data.session);
    },
    onAuthEvent: async (event, session) => {
      if (!session) return false;
      if (event === 'PASSWORD_RECOVERY') return true;
      return hasRecoveryAuthenticator();
    },
  });
}
