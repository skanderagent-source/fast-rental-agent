import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { stripHtml } from '../../utils/sanitize.js';
import { forbidden, notFound } from '../../utils/httpErrors.js';
import { logActivity } from '../activity/activity.service.js';

export async function listComments(listingId: string) {
  const { data, error } = await supabaseAdmin
    .from('commentaires')
    .select('*')
    .eq('logement_id', listingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createComment(listingId: string, agentId: string, agentNom: string, texte: string) {
  const { data, error } = await supabaseAdmin.from('commentaires').insert({
    logement_id: listingId,
    agent_id: agentId,
    agent_nom: agentNom,
    texte: stripHtml(texte),
  }).select('*').single();
  if (error) throw error;
  await logActivity({
    agentId,
    agentNom,
    typeAction: 'commentaire',
    details: 'Commentaire ajouté',
    logementId: listingId,
  });
  return data;
}

export async function deleteComment(commentId: string, userId: string, isAdmin: boolean) {
  const { data, error } = await supabaseAdmin.from('commentaires').select('*').eq('id', commentId).single();
  if (error || !data) throw notFound('Commentaire introuvable');
  if (!isAdmin && data.agent_id !== userId) throw forbidden('Non autorisé');
  await supabaseAdmin.from('commentaires').delete().eq('id', commentId);
  return { deleted: true };
}
