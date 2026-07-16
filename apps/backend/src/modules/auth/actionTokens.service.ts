import { createHash, randomBytes } from 'node:crypto';
import type { SensitiveAction } from '@fast-rental/shared';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';

const ACTION_TOKEN_TTL_MS = 5 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function issueActionToken(
  userId: string,
  action: SensitiveAction,
  targetId?: string,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACTION_TOKEN_TTL_MS);
  const token = randomBytes(32).toString('base64url');

  await supabaseAdmin
    .from('security_action_tokens')
    .delete()
    .eq('user_id', userId)
    .lte('expires_at', now.toISOString());

  const { error } = await supabaseAdmin.from('security_action_tokens').insert({
    token_hash: hashToken(token),
    user_id: userId,
    action,
    target_id: targetId ?? '',
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function consumeActionToken(
  token: string,
  userId: string,
  action: SensitiveAction,
  targetId?: string,
) {
  const { data, error } = await supabaseAdmin
    .from('security_action_tokens')
    .delete()
    .eq('token_hash', hashToken(token))
    .eq('user_id', userId)
    .eq('action', action)
    .eq('target_id', targetId ?? '')
    .gt('expires_at', new Date().toISOString())
    .select('token_hash')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
