import { Router } from 'express';
import { listingsQuerySchema } from '@fast-rental/shared';
import { validateRequest } from '../middleware/validateRequest.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId } from '../utils/params.js';
import { getListing, listListingMedia, listListings } from '../modules/listings/listings.service.js';
import { createPublicLead } from '../modules/leads/leads.service.js';
import { createLeadSchema } from '@fast-rental/shared';

const router = Router();

router.get('/listings', validateRequest(listingsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const data = await listListings(req.query as never, true);
  res.json({ data });
}));

router.get('/listings/:id', asyncHandler(async (req, res) => {
  const listing = await getListing(paramId(req.params.id), true);
  const media = await listListingMedia(paramId(req.params.id), true);
  res.json({ data: { listing, media } });
}));

router.post('/leads', validateRequest(createLeadSchema), asyncHandler(async (req, res) => {
  const data = await createPublicLead(req.body);
  res.status(201).json({ data });
}));

export default router;
