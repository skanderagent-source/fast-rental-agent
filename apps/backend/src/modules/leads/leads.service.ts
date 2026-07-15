import type { LeadListItem, TraitementStatut } from '@fast-rental/shared';
import { AGENT_ARCHIVED_TRAITEMENT_STATUTS } from '@fast-rental/shared';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { getPagination } from '../../utils/pagination.js';
import { emailService } from '../email/email.service.js';
import { logActivity } from '../activity/activity.service.js';
import { conflict, forbidden, notFound } from '../../utils/httpErrors.js';

async function fetchListingAdresse(listingId: string | null | undefined) {
  if (!listingId) return null;
  const { data } = await supabaseAdmin.from('logements').select('adresse').eq('id', listingId).maybeSingle();
  return data?.adresse ?? null;
}

async function enrichLeads(items: LeadListItem[]): Promise<LeadListItem[]> {
  if (items.length === 0) return items;

  const listingIds = [...new Set(items.map((lead) => lead.listing_id).filter(Boolean))] as string[];
  const refAgentIds = [...new Set(items.map((lead) => lead.ref_agent_id).filter(Boolean))] as string[];

  const listingById = new Map<string, string>();
  if (listingIds.length > 0) {
    const { data } = await supabaseAdmin.from('logements').select('id,adresse').in('id', listingIds);
    for (const listing of data ?? []) {
      listingById.set(listing.id, listing.adresse);
    }
  }

  const agentById = new Map<string, string>();
  if (refAgentIds.length > 0) {
    const { data } = await supabaseAdmin.from('agents').select('id,nom').in('id', refAgentIds);
    for (const agent of data ?? []) {
      agentById.set(agent.id, agent.nom);
    }
  }

  return items.map((lead) => ({
    ...lead,
    listing_adresse: lead.listing_id ? listingById.get(lead.listing_id) ?? null : null,
    ref_agent_nom: lead.ref_agent_id ? agentById.get(lead.ref_agent_id) ?? null : null,
  }));
}

function applyAgentAssignedLeadFilters<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  agentId: string,
) {
  return query.eq('assigne_a', agentId);
}

function applyArchivedFilters<T extends {
  eq: (column: string, value: string) => T;
  gte: (column: string, value: string) => T;
  lte: (column: string, value: string) => T;
}>(
  query: T,
  filters: { assignedTo?: string; archivedFrom?: string; archivedTo?: string },
  dateColumn: 'archived_at' | 'last_agent_update_at' = 'archived_at',
) {
  let next = query;
  if (filters.assignedTo) next = next.eq('assigne_a', filters.assignedTo);
  if (filters.archivedFrom) {
    next = next.gte(dateColumn, new Date(`${filters.archivedFrom}T00:00:00`).toISOString());
  }
  if (filters.archivedTo) {
    next = next.lte(dateColumn, new Date(`${filters.archivedTo}T23:59:59.999`).toISOString());
  }
  return next;
}

export async function listLeads(
  profile: { id: string; role: string },
  query: {
    includeArchived?: boolean;
    assignedTo?: string;
    archivedFrom?: string;
    archivedTo?: string;
    page: number;
    pageSize: number;
  },
) {
  const { from, to } = getPagination(query.page, query.pageSize);
  let dbQuery = supabaseAdmin.from('demandes_clients').select('*', { count: 'exact' });

  if (profile.role === 'admin') {
    if (query.includeArchived) {
      dbQuery = applyArchivedFilters(
        dbQuery
          .or('assigne_a.not.is.null')
          .order('archived_at', { ascending: false, nullsFirst: false }),
        {
          assignedTo: query.assignedTo,
          archivedFrom: query.archivedFrom,
          archivedTo: query.archivedTo,
        },
      );
    } else {
      // Unassigned queue — includes legacy rows archived without an agent.
      dbQuery = dbQuery
        .is('assigne_a', null)
        .order('created_at', { ascending: false });
    }
  } else if (query.includeArchived) {
    dbQuery = applyArchivedFilters(
      dbQuery
        .eq('assigne_a', profile.id)
        .in('traitement_statut', [...AGENT_ARCHIVED_TRAITEMENT_STATUTS])
        .order('last_agent_update_at', { ascending: false, nullsFirst: false }),
      {
        archivedFrom: query.archivedFrom,
        archivedTo: query.archivedTo,
      },
      'last_agent_update_at',
    );
  } else {
    dbQuery = applyAgentAssignedLeadFilters(dbQuery, profile.id)
      .or('traitement_statut.eq.assigné,traitement_statut.eq.contacté,traitement_statut.is.null')
      .order('assigne_le', { ascending: false, nullsFirst: false });
  }

  const { data, error, count } = await dbQuery.range(from, to);
  if (error) throw error;

  let badgeCount = 0;
  if (profile.role === 'admin') {
    const { count: unassigned } = await supabaseAdmin
      .from('demandes_clients')
      .select('*', { count: 'exact', head: true })
      .is('assigne_a', null);
    badgeCount = unassigned ?? 0;
  } else {
    const { count: assigned } = await supabaseAdmin
      .from('demandes_clients')
      .select('*', { count: 'exact', head: true })
      .eq('assigne_a', profile.id)
      .eq('traitement_statut', 'assigné');
    badgeCount = assigned ?? 0;
  }

  return {
    items: await enrichLeads((data ?? []) as LeadListItem[]),
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
    .single();
  if (agentError || !agent || agent.actif === false) throw notFound('Agent introuvable');

  // Assignment must use assign_demande_client RPC — not a direct .update().
  // The backend writes with the service role (no auth.uid()), while legacy Orcha
  // trigger protect_demande_fields() only trusts is_admin() or this RPC path.
  // Admin authorization is enforced above in leads.routes (requireRole('admin')).
  const { data, error } = await supabaseAdmin.rpc('assign_demande_client', {
    p_lead_id: leadId,
    p_agent_id: agentId,
    p_assignation_type: 'manual',
  });
  if (error) throw error;
  if (!data || (data as LeadListItem).assigne_a !== agentId) {
    throw conflict('Assignation non enregistrée — vérifiez que l’agent existe dans Supabase');
  }

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
    });
  }
  return data;
}

export async function updateLeadProgress(
  leadId: string,
  traitementStatut: TraitementStatut,
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

export async function deleteLead(leadId: string) {
  await supabaseAdmin.from('demandes_clients').delete().eq('id', leadId);
  return { deleted: true };
}

export async function getAgentCalls(agentId: string) {
  const { data, error } = await supabaseAdmin
    .from('demandes_clients')
    .select('*')
    .eq('assigne_a', agentId)
    .or('traitement_statut.eq.assigné,traitement_statut.eq.contacté,traitement_statut.is.null')
    .order('assigne_le', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return enrichLeads((data ?? []) as LeadListItem[]);
}
