import { Router } from 'express';
import { assignLeadSchema, leadsQuerySchema, updateLeadProgressSchema } from '@fast-rental/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requireActionToken } from '../../middleware/requireActionToken.js';
import { requirePermission } from '../../middleware/requireRole.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { paramId } from '../../utils/params.js';
import {
  assignLead,
  deleteLead,
  getAgentCalls,
  listLeads,
  updateLeadProgress,
} from './leads.service.js';

const router = Router();

router.get('/', requireAuth, validateRequest(leadsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const profile = res.locals.profile as { id: string; role: string };
  const data = await listLeads(profile, req.query as never);
  res.json({ data });
}));

router.get('/my-calls', requireAuth, asyncHandler(async (req, res) => {
  const profile = res.locals.profile as { id: string };
  const data = await getAgentCalls(profile.id);
  res.json({ data });
}));

router.post('/:id/assign', requireAuth, requirePermission('leads.assign'), validateRequest(assignLeadSchema), asyncHandler(async (req, res) => {
  const admin = res.locals.profile as { id: string; nom: string };
  const data = await assignLead(paramId(req.params.id), req.body.agentId, admin.id, admin.nom);
  res.json({ data });
}));

router.patch('/:id/progress', requireAuth, validateRequest(updateLeadProgressSchema), asyncHandler(async (req, res) => {
  const profile = res.locals.profile as { id: string; role: string };
  const data = await updateLeadProgress(paramId(req.params.id), req.body.traitementStatut, profile);
  res.json({ data });
}));

router.delete('/:id', requireAuth, requirePermission('leads.delete'), requireActionToken('lead.delete', 'id'), asyncHandler(async (req, res) => {
  const data = await deleteLead(paramId(req.params.id));
  res.json({ data });
}));

export default router;
