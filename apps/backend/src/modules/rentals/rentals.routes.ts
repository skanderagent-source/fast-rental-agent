import { Router } from 'express';
import { createRentalSchema } from '@fast-rental/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { logActivity } from '../activity/activity.service.js';

const router = Router();

router.get('/me', requireAuth, asyncHandler(async (_req, res) => {
  const profile = res.locals.profile as { id: string; role: string };
  let q = supabaseAdmin.from('rentals').select('*, logements(adresse, quartier)').order('rented_at', { ascending: false });
  if (profile.role !== 'admin') q = q.eq('agent_id', profile.id);
  const { data, error } = await q;
  if (error) throw error;
  res.json({ data: data ?? [] });
}));

router.post('/', requireAuth, validateRequest(createRentalSchema), asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const profile = res.locals.profile as { id: string; nom: string; role: string };
  const agentId = profile.role === 'admin' && req.body.agentId ? req.body.agentId : user.id;
  const { data, error } = await supabaseAdmin.from('rentals').insert({
    listing_id: req.body.listingId,
    agent_id: agentId,
    lead_id: req.body.leadId ?? null,
    monthly_rent: req.body.monthlyRent ?? null,
    rented_at: req.body.rentedAt ?? new Date().toISOString(),
    notes: req.body.notes ?? null,
    created_by: user.id,
  }).select('*').single();
  if (error) throw error;
  await logActivity({
    agentId: user.id,
    agentNom: profile.nom,
    typeAction: 'rental_recorded',
    details: 'Location enregistrée',
    logementId: req.body.listingId,
  });
  res.json({ data });
}));

export default router;
