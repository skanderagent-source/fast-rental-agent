import { createClient } from '@supabase/supabase-js';
import { AGENT_PROFILE_SELECT, normalizePhoneDigits, referralUsernameFromNom, toAgentProfile } from '@fast-rental/shared';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { badRequest, conflict, forbidden, HttpError } from '../../utils/httpErrors.js';
import { logActivity, shouldLogLogin } from '../activity/activity.service.js';
import { emailService } from '../email/email.service.js';

export async function getMe(userId: string, userEmail: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('agents')
    .select(AGENT_PROFILE_SELECT)
    .eq('id', userId)
    .single();
  if (error || !profile) throw Object.assign(new Error('Profil introuvable'), { status: 403, code: 'FORBIDDEN' });

  const row = profile as unknown as {
    id: string;
    email: string;
    nom: string;
    telephone: string | null;
    role: 'admin' | 'agent';
    actif: boolean;
    must_change_password: boolean;
    referral_slug: string;
  };

  if (row.email !== userEmail) {
    await supabaseAdmin.from('agents').update({ email: userEmail }).eq('id', userId);
    row.email = userEmail;
  }

  return {
    user: { id: userId, email: userEmail },
    profile: toAgentProfile(row),
  };
}

async function verifyCurrentPassword(email: string, password: string) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new HttpError(401, 'INVALID_PASSWORD', 'Mot de passe incorrect');
  }
}

export async function updateProfile(
  userId: string,
  input: {
    nom?: string;
    telephone?: string | null;
    profilePhotoMediaId?: string | null;
  },
  options: { notifyEmail?: string | null } = {},
) {
  if (input.profilePhotoMediaId !== undefined && input.profilePhotoMediaId !== null) {
    const { data: media, error: mediaError } = await supabaseAdmin
      .from('user_media')
      .select('id')
      .eq('id', input.profilePhotoMediaId)
      .eq('user_id', userId)
      .maybeSingle();
    if (mediaError) throw mediaError;
    if (!media) throw forbidden('Photo de profil invalide');
  }

  let previousTelephone: string | null | undefined;
  if (input.telephone !== undefined) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from('agents')
      .select('telephone')
      .eq('id', userId)
      .single();
    if (currentError) throw currentError;
    previousTelephone = (current?.telephone as string | null | undefined) ?? null;
  }

  const updates: Record<string, unknown> = {};
  if (input.nom !== undefined) {
    const referral_slug = referralUsernameFromNom(input.nom);
    if (!referral_slug) {
      throw Object.assign(
        new Error('Le nom doit être un identifiant valide (lettres a-z, 3–32 caractères)'),
        { status: 400, code: 'VALIDATION_ERROR' },
      );
    }
    const { data: slugConflict } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('referral_slug', referral_slug)
      .neq('id', userId)
      .maybeSingle();
    if (slugConflict) {
      throw Object.assign(new Error('Ce nom d\'utilisateur est déjà pris'), { status: 409, code: 'CONFLICT' });
    }
    updates.nom = input.nom;
    updates.referral_slug = referral_slug;
  }
  if (input.telephone !== undefined) {
    updates.telephone = input.telephone === '' ? null : input.telephone;
  }
  if (input.profilePhotoMediaId !== undefined) updates.profile_photo_media_id = input.profilePhotoMediaId;

  const { data, error } = await supabaseAdmin
    .from('agents')
    .update(updates)
    .eq('id', userId)
    .select(AGENT_PROFILE_SELECT)
    .single();
  if (error || !data) throw error;

  if (input.telephone !== undefined) {
    const nextTelephone = (updates.telephone as string | null | undefined) ?? null;
    const previousDigits = normalizePhoneDigits(previousTelephone);
    const nextDigits = normalizePhoneDigits(nextTelephone);
    // Notify only when replacing an existing number (not first-time set on invite).
    if (previousDigits && previousDigits !== nextDigits) {
      const notifyTo = options.notifyEmail?.trim() || (data as { email?: string }).email;
      if (notifyTo) {
        emailService.notifyPhoneChanged(notifyTo, { phone: nextTelephone });
      }
    }
  }

  return toAgentProfile(data as unknown as Record<string, unknown>);
}

export async function changeEmail(
  userId: string,
  currentEmail: string,
  input: { email: string; currentPassword: string },
) {
  const nextEmail = input.email.trim().toLowerCase();
  const previousEmail = currentEmail.trim().toLowerCase();
  if (!previousEmail) {
    throw badRequest('Email actuel introuvable', 'VALIDATION_ERROR');
  }
  if (nextEmail === previousEmail) {
    throw badRequest('Le nouvel email doit être différent', 'VALIDATION_ERROR');
  }

  await verifyCurrentPassword(previousEmail, input.currentPassword);

  const { data: emailConflict } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('email', nextEmail)
    .neq('id', userId)
    .maybeSingle();
  if (emailConflict) {
    throw conflict('Cet email est déjà utilisé');
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: nextEmail,
    email_confirm: true,
  });
  if (authError) {
    throw badRequest(authError.message || 'Impossible de mettre à jour l\'email', 'EMAIL_UPDATE_FAILED');
  }

  const { data, error } = await supabaseAdmin
    .from('agents')
    .update({ email: nextEmail })
    .eq('id', userId)
    .select(AGENT_PROFILE_SELECT)
    .single();
  if (error || !data) throw error;

  // One security notice to the previous address — no Auth confirmation emails.
  emailService.notifyEmailChanged(previousEmail, { oldEmail: previousEmail, newEmail: nextEmail });

  return toAgentProfile(data as unknown as Record<string, unknown>);
}

export async function logLoginActivity(agentId: string, agentNom: string) {
  if (!(await shouldLogLogin(agentId))) return;
  await logActivity({
    agentId,
    agentNom,
    typeAction: 'connexion',
    details: "Connexion à l'application",
  });
}

export async function clearMustChangePassword(userId: string) {
  await supabaseAdmin.from('agents').update({ must_change_password: false }).eq('id', userId);
}
