import {
  isValidReferralUsername,
  MAX_USERS_LIST,
  normalizeReferralUsername,
  referralUsernameFromNom,
} from '@fast-rental/shared';
import { primaryFrontendOrigin } from '../../config/env.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { logActivity } from '../activity/activity.service.js';
import { conflict, forbidden } from '../../utils/httpErrors.js';

function inviteRedirectTo() {
  return `${primaryFrontendOrigin()}/auth/accept-invite`;
}

async function assertReferralSlugAvailable(slug: string, excludeUserId?: string) {
  let query = supabaseAdmin.from('agents').select('id').eq('referral_slug', slug);
  if (excludeUserId) query = query.neq('id', excludeUserId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (data) throw conflict('Ce nom d\'utilisateur est déjà pris');
}

export async function listUsers() {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('*')
    .order('created_at')
    .limit(MAX_USERS_LIST);
  if (error) throw error;
  return data ?? [];
}

export async function createUser(input: {
  nom: string;
  email: string;
  role: 'admin' | 'agent';
}, actorId: string, actorNom: string) {
  const referral_slug = referralUsernameFromNom(input.nom);
  if (!referral_slug) {
    throw Object.assign(
      new Error('Le nom doit être un identifiant valide (lettres a-z, 3–32 caractères)'),
      { status: 400, code: 'VALIDATION_ERROR' },
    );
  }

  const { data: existingSlug } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('referral_slug', referral_slug)
    .maybeSingle();
  if (existingSlug) throw conflict('Ce nom d\'utilisateur est déjà pris');

  // Invite-only: public signup stays disabled in Supabase; only invited emails get a link.
  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
    data: { nom: input.nom, role: input.role },
    redirectTo: inviteRedirectTo(),
  });
  if (error) throw error;
  if (!invited.user) {
    throw Object.assign(new Error('Invitation impossible'), { status: 502, code: 'INVITE_FAILED' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('agents')
    .upsert({
      id: invited.user.id,
      email: input.email,
      nom: input.nom,
      telephone: null,
      role: input.role,
      actif: true,
      must_change_password: true,
      referral_slug,
    })
    .select('*')
    .single();
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
    throw profileError;
  }

  await logActivity({
    agentId: actorId,
    agentNom: actorNom,
    typeAction: 'compte_cree',
    details: `Invitation envoyée: ${input.nom} (${input.role})`,
  });
  return profile;
}

export async function updateUser(id: string, input: { nom?: string; role?: 'admin' | 'agent'; actif?: boolean }) {
  const updates: { nom?: string; role?: 'admin' | 'agent'; actif?: boolean; referral_slug?: string } = { ...input };

  if (input.nom !== undefined) {
    const referral_slug = referralUsernameFromNom(input.nom);
    if (!referral_slug) {
      throw Object.assign(
        new Error('Le nom doit être un identifiant valide (lettres a-z, 3–32 caractères)'),
        { status: 400, code: 'VALIDATION_ERROR' },
      );
    }
    await assertReferralSlugAvailable(referral_slug, id);
    updates.referral_slug = referral_slug;
  }

  const { data, error } = await supabaseAdmin.from('agents').update(updates).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateUserReferralSlug(
  id: string,
  referralSlug: string,
  actorId: string,
  actorNom: string,
) {
  const username = normalizeReferralUsername(referralSlug);
  if (!isValidReferralUsername(username)) {
    throw Object.assign(new Error('Nom d\'utilisateur invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('agents')
    .select('nom, referral_slug')
    .eq('id', id)
    .single();
  if (currentError || !current) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404, code: 'NOT_FOUND' });
  const currentUsername = referralUsernameFromNom(current.nom);
  if (currentUsername === username) return current;

  await assertReferralSlugAvailable(username, id);

  const { data, error } = await supabaseAdmin
    .from('agents')
    .update({ nom: username, referral_slug: username })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  await logActivity({
    agentId: actorId,
    agentNom: actorNom,
    typeAction: 'compte_modifie',
    details: `Nom d'utilisateur de ${current.nom}: ${currentUsername ?? current.nom} → ${username}`,
  });

  return data;
}

export async function deactivateUser(id: string, actorId: string, actorNom: string) {
  if (id === actorId) throw forbidden('Cannot deactivate yourself');
  const profile = await updateUser(id, { actif: false });
  await logActivity({ agentId: actorId, agentNom: actorNom, typeAction: 'agent_deactivate', details: `${profile.nom} désactivé` });
  return profile;
}

export async function reactivateUser(id: string, actorId: string, actorNom: string) {
  const profile = await updateUser(id, { actif: true });
  await logActivity({ agentId: actorId, agentNom: actorNom, typeAction: 'agent_reactivate', details: `${profile.nom} réactivé` });
  return profile;
}

export async function deleteUser(id: string, actorId: string, actorNom: string) {
  if (id === actorId) throw forbidden('Cannot delete yourself');
  const { data: profile } = await supabaseAdmin.from('agents').select('nom').eq('id', id).single();
  await supabaseAdmin.from('agents').delete().eq('id', id);
  await supabaseAdmin.auth.admin.deleteUser(id);
  await logActivity({ agentId: actorId, agentNom: actorNom, typeAction: 'agent_delete', details: `${profile?.nom ?? id} supprimé` });
  return { deleted: true };
}
