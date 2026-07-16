import { Router } from 'express';
import { actionTokenRequestSchema, updateProfileSchema } from '@fast-rental/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getMe, logLoginActivity, updateProfile, clearMustChangePassword } from './auth.service.js';
import { issueActionToken } from './actionTokens.service.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const user = res.locals.user as { id: string; email?: string };
    const data = await getMe(user.id, user.email ?? '');
    res.json({ data });
  }),
);

router.patch(
  '/',
  requireAuth,
  validateRequest(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = res.locals.user as { id: string };
    const profile = res.locals.profile as { nom: string };
    const data = await updateProfile(user.id, {
      nom: req.body.nom,
      telephone: req.body.telephone,
      profilePhotoMediaId: req.body.profilePhotoMediaId,
    });
    res.json({ data });
  }),
);

router.post(
  '/action-token',
  requireAuth,
  validateRequest(actionTokenRequestSchema),
  asyncHandler(async (req, res) => {
    const user = res.locals.user as { id: string };
    const data = await issueActionToken(user.id, req.body.action, req.body.targetId);
    res.status(201).json({ data });
  }),
);

router.post(
  '/activity/login',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const user = res.locals.user as { id: string };
    const profile = res.locals.profile as { nom: string };
    await logLoginActivity(user.id, profile.nom);
    res.json({ data: { logged: true } });
  }),
);

router.post(
  '/password-updated',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const user = res.locals.user as { id: string };
    await clearMustChangePassword(user.id);
    const data = await getMe(user.id, (res.locals.user as { email?: string }).email ?? '');
    res.json({ data: data.profile });
  }),
);

export default router;
