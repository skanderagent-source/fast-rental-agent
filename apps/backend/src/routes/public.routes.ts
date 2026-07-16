import { Router } from 'express';
import { listingsQuerySchema } from '@fast-rental/shared';
import { validateRequest } from '../middleware/validateRequest.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId } from '../utils/params.js';
import { sendValidatedData } from '../utils/respond.js';
import { getListing, listListingMedia, listListings } from '../modules/listings/listings.service.js';
import {
  publicListingDetailDataSchema,
  publicListingsDataSchema,
} from './public.schemas.js';

const router = Router();

router.get('/listings', validateRequest(listingsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const data = await listListings(req.query as never, true);
  sendValidatedData(res, publicListingsDataSchema, data);
}));

router.get('/listings/:id', asyncHandler(async (req, res) => {
  const listing = await getListing(paramId(req.params.id), true);
  const media = await listListingMedia(paramId(req.params.id), true);
  sendValidatedData(res, publicListingDetailDataSchema, { listing, media });
}));

export default router;
