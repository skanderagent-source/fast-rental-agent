import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { logActivity, shouldLogLogin } from '../activity/activity.service.js';

export async function getMe(userId: string, userEmail: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !profile) throw Object.assign(new Error('Profil introuvable'), { status: 403, code: 'FORBIDDEN' });

  if (profile.email !== userEmail) {
    await supabaseAdmin.from('agents').update({ email: userEmail }).eq('id', userId);
    profile.email = userEmail;
  }

  return {
    user: { id: userId, email: userEmail },
    profile,
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
  const updates: Record<string, unknown> = {};
  if (input.nom !== undefined) updates.nom = input.nom;
  if (input.telephone !== undefined) updates.telephone = input.telephone;
  if (input.profilePhotoMediaId !== undefined) updates.profile_photo_media_id = input.profilePhotoMediaId;
  const { data, error } = await supabaseAdmin
    .from('agents')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
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
