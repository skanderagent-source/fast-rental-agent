import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { emailService } from '../email/email.service.js';
import { listListings, getListing, listListingMedia } from '../listings/listings.service.js';

export async function getAdminStats() {
  const [{ count: totalListings }, { count: available }, { count: totalLeads }, { count: newLeads }, { count: pendingMedia }] = await Promise.all([
    supabaseAdmin.from('logements').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseAdmin.from('logements').select('*', { count: 'exact', head: true }).eq('statut', 'Available').is('deleted_at', null),
    supabaseAdmin.from('demandes_clients').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('demandes_clients').select('*', { count: 'exact', head: true }).eq('statut', 'nouveau'),
    supabaseAdmin.from('listing_media').select('*', { count: 'exact', head: true }).eq('status', 'pending').not('upload_completed_at', 'is', null),
  ]);

  return {
    totalListings: totalListings ?? 0,
    availableListings: available ?? 0,
    totalLeads: totalLeads ?? 0,
    newLeads: newLeads ?? 0,
    pendingMedia: pendingMedia ?? 0,
  };
}

export async function getAgentStats() {
  const { data: agents } = await supabaseAdmin.from('agents').select('*').order('nom');
  const stats = [];

  for (const agent of agents ?? []) {
    const [
      { count: assignedLeads },
      { count: contactedLeads },
      { count: resolvedLeads },
      { count: rentalCount },
      { data: rentals },
      { count: mediaUploaded },
      { count: approvedMedia },
      { count: rejectedMedia },
      { data: lastLogin },
    ] = await Promise.all([
      supabaseAdmin.from('demandes_clients').select('*', { count: 'exact', head: true }).eq('assigne_a', agent.id),
      supabaseAdmin.from('demandes_clients').select('*', { count: 'exact', head: true }).eq('assigne_a', agent.id).eq('traitement_statut', 'contacté'),
      supabaseAdmin.from('demandes_clients').select('*', { count: 'exact', head: true }).eq('assigne_a', agent.id).eq('traitement_statut', 'réglé'),
      supabaseAdmin.from('rentals').select('*', { count: 'exact', head: true }).eq('agent_id', agent.id),
      supabaseAdmin.from('rentals').select('monthly_rent').eq('agent_id', agent.id),
      supabaseAdmin.from('listing_media').select('*', { count: 'exact', head: true }).eq('uploaded_by', agent.id),
      supabaseAdmin.from('listing_media').select('*', { count: 'exact', head: true }).eq('uploaded_by', agent.id).eq('status', 'approved'),
      supabaseAdmin.from('listing_media').select('*', { count: 'exact', head: true }).eq('uploaded_by', agent.id).eq('status', 'rejected'),
      supabaseAdmin.from('activite').select('created_at').eq('agent_id', agent.id).eq('type_action', 'connexion').order('created_at', { ascending: false }).limit(1),
    ]);

    stats.push({
      agentId: agent.id,
      nom: agent.nom,
      email: agent.email,
      assignedLeads: assignedLeads ?? 0,
      contactedLeads: contactedLeads ?? 0,
      resolvedLeads: resolvedLeads ?? 0,
      rentalCount: rentalCount ?? 0,
      rentalRevenueTotal: (rentals ?? []).reduce((s, r) => s + Number(r.monthly_rent ?? 0), 0),
      mediaUploaded: mediaUploaded ?? 0,
      approvedMedia: approvedMedia ?? 0,
      rejectedMedia: rejectedMedia ?? 0,
      lastLoginAt: lastLogin?.[0]?.created_at ?? null,
    });
  }

  return stats;
}

import { createDownloadUrl } from '../media/storage.service.js';

export async function getPendingMedia() {
  const { data, error } = await supabaseAdmin
    .from('listing_media')
    .select('*, logements(adresse)')
    .eq('status', 'pending')
    .not('upload_completed_at', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const items = await Promise.all((data ?? []).map(async (m) => {
    if (m.object_key && m.upload_completed_at) {
      const viewUrl = await createDownloadUrl(m.object_key, m.original_filename, true);
      return { ...m, viewUrl };
    }
    return m;
  }));
  return items;
}

export async function getRecentActivity() {
  const { data, error } = await supabaseAdmin
    .from('activite')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function sendTestEmail(to: string) {
  await emailService.sendTestEmail(to);
  return { sent: true };
}

export { listListings, getListing, listListingMedia };
