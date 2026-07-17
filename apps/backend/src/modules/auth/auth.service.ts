import { AGENT_PROFILE_SELECT, referralUsernameFromNom, toAgentProfile } from '@fast-rental/shared';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { forbidden } from '../../utils/httpErrors.js';
import { logActivity, shouldLogLogin } from '../activity/activity.service.js';

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

export async function updateProfile(
  userId: string,
  input: {
    nom?: string;
    telephone?: string | null;
    profilePhotoMediaId?: string | null;
  },
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
  const updates: Record<string, unknown> = {};
  if (input.nom !== undefined) {
    const referral_slug = referralUsernameFromNom(input.nom);
    if (!referral_slug) {
      throw Object.assign(
        new Error('Le nom doit être un identifiant valide (a-z, 0-9, 3–32 caractères)'),
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
  if (input.telephone !== undefined) updates.telephone = input.telephone;
  if (input.profilePhotoMediaId !== undefined) updates.profile_photo_media_id = input.profilePhotoMediaId;
  const { data, error } = await supabaseAdmin
    .from('agents')
    .update(updates)
    .eq('id', userId)
    .select(AGENT_PROFILE_SELECT)
    .single();
  if (error || !data) throw error;
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
