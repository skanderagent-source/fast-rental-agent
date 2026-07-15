import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { emailService } from '../email/email.service.js';
import { logActivity } from '../activity/activity.service.js';
import { forbidden } from '../../utils/httpErrors.js';

export async function listUsers() {
  const { data, error } = await supabaseAdmin.from('agents').select('*').order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createUser(input: {
  nom: string;
  email: string;
  telephone?: string;
  password: string;
  role: 'admin' | 'agent';
}, actorId: string, actorNom: string) {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nom: input.nom, role: input.role },
  });
  if (error) throw error;

  const telephone = input.telephone?.trim() || null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('agents')
    .upsert({
      id: created.user.id,
      email: input.email,
      nom: input.nom,
      telephone,
      role: input.role,
      actif: true,
      must_change_password: true,
    })
    .select('*')
    .single();
  if (profileError) throw profileError;

  await logActivity({
    agentId: actorId,
    agentNom: actorNom,
    typeAction: 'compte_cree',
    details: `Compte créé: ${input.nom} (${input.role})`,
  });
  emailService.notifyAccountCreated(input.email, { nom: input.nom, email: input.email });
  return profile;
}

export async function updateUser(id: string, input: { nom?: string; role?: 'admin' | 'agent'; actif?: boolean }) {
  const { data, error } = await supabaseAdmin.from('agents').update(input).eq('id', id).select('*').single();
  if (error) throw error;
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
