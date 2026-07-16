import { Router } from 'express';
import { createRentalSchema } from '@fast-rental/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createRental, listMyRentals } from './rentals.service.js';

const router = Router();

router.get('/me', requireAuth, asyncHandler(async (_req, res) => {
  const profile = res.locals.profile as { id: string; role: string };
  const data = await listMyRentals(profile);
  res.json({ data });
}));

router.post('/', requireAuth, validateRequest(createRentalSchema), asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const profile = res.locals.profile as { id: string; nom: string; role: string };
  const data = await createRental(req.body, user, profile);
  res.json({ data });
}));

export default router;
