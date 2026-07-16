import { MAX_RENTALS_LIST } from '@fast-rental/shared';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { forbidden, notFound } from '../../utils/httpErrors.js';
import { logActivity } from '../activity/activity.service.js';

export async function listMyRentals(profile: { id: string; role: string }) {
  let query = supabaseAdmin
    .from('rentals')
    .select('*, logements(adresse, quartier)')
    .order('rented_at', { ascending: false })
    .limit(MAX_RENTALS_LIST);
  if (profile.role !== 'admin') {
    query = query.eq('agent_id', profile.id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createRental(
  input: {
    listingId: string;
    leadId?: string | null;
    agentId?: string;
    monthlyRent?: number | null;
    rentedAt?: string | null;
    notes?: string | null;
  },
  user: { id: string },
  profile: { id: string; nom: string; role: string },
) {
  const agentId = profile.role === 'admin' && input.agentId ? input.agentId : user.id;

  if (profile.role !== 'admin' && input.agentId && input.agentId !== user.id) {
    throw forbidden('Non autorisé');
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('logements')
    .select('id')
    .eq('id', input.listingId)
    .is('deleted_at', null)
    .maybeSingle();
  if (listingError) throw listingError;
  if (!listing) throw notFound('Logement introuvable');

  if (profile.role === 'admin' && input.agentId) {
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, actif')
      .eq('id', input.agentId)
      .maybeSingle();
    if (agentError) throw agentError;
    if (!agent || agent.actif === false) throw notFound('Agent introuvable');
  }

  if (input.leadId) {
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('demandes_clients')
      .select('id, assigne_a')
      .eq('id', input.leadId)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) throw notFound('Demande introuvable');
    if (profile.role !== 'admin' && lead.assigne_a !== agentId) {
      throw forbidden('Non autorisé');
    }
  }

  const { data, error } = await supabaseAdmin
    .from('rentals')
    .insert({
      listing_id: input.listingId,
      agent_id: agentId,
      lead_id: input.leadId ?? null,
      monthly_rent: input.monthlyRent ?? null,
      rented_at: input.rentedAt ?? new Date().toISOString(),
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select('*')
    .single();
  if (error) throw error;

  await logActivity({
    agentId: user.id,
    agentNom: profile.nom,
    typeAction: 'rental_recorded',
    details: 'Location enregistrée',
    logementId: input.listingId,
  });

  return data;
}
