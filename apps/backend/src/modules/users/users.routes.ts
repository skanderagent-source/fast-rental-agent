import { Router } from 'express';
import { createUserSchema, updateUserReferralSlugSchema, updateUserSchema } from '@fast-rental/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { paramId } from '../../utils/params.js';
import {
  createUser,
  deactivateUser,
  deleteUser,
  listUsers,
  reactivateUser,
  updateUser,
  updateUserReferralSlug,
} from './users.service.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
  const data = await listUsers();
  res.json({ data });
}));

router.post('/', requireAuth, requireRole('admin'), validateRequest(createUserSchema), asyncHandler(async (req, res) => {
  const actor = res.locals.profile as { id: string; nom: string };
  const data = await createUser(req.body, actor.id, actor.nom);
  res.json({ data });
}));

router.patch('/:id', requireAuth, requireRole('admin'), validateRequest(updateUserSchema), asyncHandler(async (req, res) => {
  const data = await updateUser(paramId(req.params.id), req.body);
  res.json({ data });
}));

router.patch('/:id/referral-slug', requireAuth, requireRole('admin'), validateRequest(updateUserReferralSlugSchema), asyncHandler(async (req, res) => {
  const actor = res.locals.profile as { id: string; nom: string };
  const data = await updateUserReferralSlug(paramId(req.params.id), req.body.referralSlug, actor.id, actor.nom);
  res.json({ data });
}));

router.post('/:id/deactivate', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const actor = res.locals.profile as { id: string; nom: string };
  const data = await deactivateUser(paramId(req.params.id), actor.id, actor.nom);
  res.json({ data });
}));

router.post('/:id/reactivate', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const actor = res.locals.profile as { id: string; nom: string };
  const data = await reactivateUser(paramId(req.params.id), actor.id, actor.nom);
  res.json({ data });
}));

router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const actor = res.locals.profile as { id: string; nom: string };
  const data = await deleteUser(paramId(req.params.id), actor.id, actor.nom);
  res.json({ data });
}));

export default router;
