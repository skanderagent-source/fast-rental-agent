import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { stripHtml } from '../../utils/sanitize.js';
import { getPagination } from '../../utils/pagination.js';
import { emailService } from '../email/email.service.js';
import { logActivity } from '../activity/activity.service.js';
import { forbidden, notFound } from '../../utils/httpErrors.js';

async function fetchListingAdresse(listingId: string | null | undefined) {
  if (!listingId) return null;
  const { data } = await supabaseAdmin.from('logements').select('adresse').eq('id', listingId).maybeSingle();
  return data?.adresse ?? null;
}

export async function createPublicLead(input: {
  listingId?: string | null;
  nom: string;
  telephone?: string | null;
  email?: string | null;
  revenuMensuel?: number | null;
  scoreCredit?: number | null;
  dateDemenagement?: string | null;
  message?: string | null;
  typeDemande: 'rappel' | 'prequal';
  refAgentId?: string | null;
}) {
  let refAgentId: string | null = null;
  let suggestedAgentName: string | null = null;
  if (input.refAgentId) {
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('id, nom')
      .eq('id', input.refAgentId)
      .eq('actif', true)
      .maybeSingle();
    if (agent) {
      refAgentId = agent.id;
      suggestedAgentName = agent.nom;
    }
  }

  const { data, error } = await supabaseAdmin.from('demandes_clients').insert({
    listing_id: input.listingId ?? null,
    nom: stripHtml(input.nom),
    telephone: input.telephone ? stripHtml(input.telephone) : null,
    email: input.email ?? null,
    revenu_mensuel: input.revenuMensuel ?? null,
    score_credit: input.scoreCredit ?? null,
    date_demenagement: input.dateDemenagement ? stripHtml(input.dateDemenagement) : null,
    message: input.message ? stripHtml(input.message) : null,
    type_demande: input.typeDemande,
    statut: 'nouveau',
    ref_agent_id: refAgentId,
  }).select('*').single();
  if (error) throw error;

  const listingAdresse = await fetchListingAdresse(data.listing_id);
  const leadPayload = {
    nom: data.nom,
    telephone: data.telephone,
    email: data.email,
    revenu_mensuel: data.revenu_mensuel,
    score_credit: data.score_credit,
    date_demenagement: data.date_demenagement,
    message: data.message,
    type_demande: data.type_demande,
  };

  const { data: admins, error: adminsError } = await supabaseAdmin
    .from('agents')
    .select('email')
    .eq('role', 'admin')
    .eq('actif', true);
  if (adminsError) throw adminsError;
  const adminList = Array.isArray(admins) ? admins : admins ? [admins] : [];
  for (const admin of adminList) {
    if (admin.email) {
      emailService.notifyLeadReceivedAdmin(admin.email, {
        lead: leadPayload,
        listingAdresse,
        suggestedAgentName,
      });
    }
  }
  if (data.email) {
    emailService.notifyLeadConfirmationClient(data.email, { nom: data.nom, listingAdresse });
  }

  return data;
}

export async function listLeads(
  profile: { id: string; role: string },
  query: { includeArchived?: boolean; page: number; pageSize: number },
) {
  const { from, to } = getPagination(query.page, query.pageSize);
  let dbQuery = supabaseAdmin.from('demandes_clients').select('*', { count: 'exact' }).order('created_at', { ascending: false });

  if (profile.role === 'admin') {
    if (!query.includeArchived) dbQuery = dbQuery.eq('statut', 'nouveau');
  } else {
    dbQuery = dbQuery
      .eq('assigne_a', profile.id)
      .gt('delete_after', new Date().toISOString());
  }

  const { data, error, count } = await dbQuery.range(from, to);
  if (error) throw error;

  let badgeCount = 0;
  if (profile.role === 'admin') {
    const { count: unread } = await supabaseAdmin
      .from('demandes_clients')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'nouveau')
      .eq('lu', false);
    badgeCount = unread ?? 0;
  } else {
    const { count: assigned } = await supabaseAdmin
      .from('demandes_clients')
      .select('*', { count: 'exact', head: true })
      .eq('assigne_a', profile.id)
      .eq('traitement_statut', 'assigné')
      .gt('delete_after', new Date().toISOString());
    badgeCount = assigned ?? 0;
  }

  return {
    items: data ?? [],
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
    summary: { badgeCount },
  };
}

export async function assignLead(leadId: string, agentId: string, adminId: string, adminNom: string) {
  const { data: agent, error: agentError } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('actif', true)
    .single();
  if (agentError || !agent) throw notFound('Agent introuvable');

  const now = new Date();
  const deleteAfter = new Date(now.getTime() + 30 * 24 * 3600000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('demandes_clients')
    .update({
      assigne_a: agentId,
      assigne_nom: agent.nom,
      assigne_le: now.toISOString(),
      assignation_type: 'manual',
      statut: 'archivé',
      traitement_statut: 'assigné',
      archived_at: now.toISOString(),
      delete_after: deleteAfter,
    })
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) throw error;

  await logActivity({
    agentId: adminId,
    agentNom: adminNom,
    typeAction: 'demande_assignee',
    details: `Demande assignée à ${agent.nom}`,
  });

  const listingAdresse = await fetchListingAdresse(data.listing_id);
  if (agent.email) {
    emailService.notifyLeadAssignedAgent(agent.email, {
      agentNom: agent.nom,
      lead: {
        nom: data.nom,
        telephone: data.telephone,
        email: data.email,
        revenu_mensuel: data.revenu_mensuel,
        score_credit: data.score_credit,
        date_demenagement: data.date_demenagement,
        message: data.message,
        type_demande: data.type_demande,
      },
      listingAdresse,
      deleteAfter: data.delete_after,
    });
  }
  return data;
}

export async function updateLeadProgress(
  leadId: string,
  traitementStatut: 'assigné' | 'contacté' | 'réglé',
  profile: { id: string; role: string },
) {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('demandes_clients')
    .select('*')
    .eq('id', leadId)
    .single();
  if (leadError || !lead) throw notFound('Demande introuvable');
  if (profile.role !== 'admin' && lead.assigne_a !== profile.id) {
    throw forbidden('Non autorisé');
  }

  const { data, error } = await supabaseAdmin
    .from('demandes_clients')
    .update({
      traitement_statut: traitementStatut,
      last_agent_update_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function markLeadsRead(adminId: string) {
  await supabaseAdmin
    .from('demandes_clients')
    .update({ lu: true })
    .eq('statut', 'nouveau')
    .eq('lu', false);
  return { updated: true };
}

export async function deleteLead(leadId: string) {
  await supabaseAdmin.from('demandes_clients').delete().eq('id', leadId);
  return { deleted: true };
}

export async function getAgentCalls(agentId: string) {
  const { data, error } = await supabaseAdmin
    .from('demandes_clients')
    .select('*')
    .eq('assigne_a', agentId)
    .gt('delete_after', new Date().toISOString())
    .order('assigne_le', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
