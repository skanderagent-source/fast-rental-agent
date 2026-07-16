import { supabase } from '../../lib/supabaseClient';

export async function requestPasswordReset(email: string, redirectTo: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function hasRecoveryAuthenticator() {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return false;
  const claims = data.claims as { amr?: Array<{ method?: string }> };
  return claims.amr?.some((entry) => entry.method === 'recovery') ?? false;
}
