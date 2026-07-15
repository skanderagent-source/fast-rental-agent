import { Router, raw } from 'express';
import {
  createListingSchema,
  listingsQuerySchema,
  profilePhotoUploadSchema,
  rejectMediaSchema,
  reorderListingMediaSchema,
  requestMediaUploadSchema,
  updateListingSchema,
  MAX_VIDEO_SIZE_MB,
} from '@fast-rental/shared';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { paramId } from '../../utils/params.js';
import { logActivity } from '../activity/activity.service.js';
import {
  approveMedia,
  completeMediaUpload,
  completeProfilePhoto,
  createListing,
  deleteMedia,
  getListing,
  getMediaDownloadUrl,
  listListingMedia,
  listListings,
  listMapListings,
  listUserMedia,
  rejectMedia,
  reorderListingMedia,
  requestMediaUpload,
  requestProfilePhotoUpload,
  softDeleteListing,
  updateListing,
  uploadMediaFile,
} from './listings.service.js';

const router = Router();

router.get('/', requireAuth, validateRequest(listingsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const data = await listListings(req.query as never, false);
  res.json({ data });
}));

router.get('/map', requireAuth, asyncHandler(async (_req, res) => {
  const data = await listMapListings();
  res.json({ data });
}));

router.post('/', requireAuth, requireRole('admin'), validateRequest(createListingSchema), asyncHandler(async (req, res) => {
  const profile = res.locals.profile as { id: string; nom: string };
  const data = await createListing(req.body, profile.id);
  await logActivity({ agentId: profile.id, agentNom: profile.nom, typeAction: 'logement_ajoute', details: `Ajout: ${data.adresse}`, logementId: data.id });
  res.json({ data });
}));

router.post('/me/profile-photo/upload-url', requireAuth, validateRequest(profilePhotoUploadSchema), asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const data = await requestProfilePhotoUpload(user.id, req.body);
  res.json({ data });
}));

router.post('/me/profile-photo/:mediaId/complete', requireAuth, asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const data = await completeProfilePhoto(user.id, paramId(req.params.mediaId));
  res.json({ data });
}));

router.get('/me/media', requireAuth, asyncHandler(async (_req, res) => {
  const user = res.locals.user as { id: string };
  const data = await listUserMedia(user.id);
  res.json({ data });
}));

router.post('/media/:mediaId/approve', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const admin = res.locals.user as { id: string };
  const data = await approveMedia(paramId(req.params.mediaId), admin.id);
  res.json({ data });
}));

router.post('/media/:mediaId/reject', requireAuth, requireRole('admin'), validateRequest(rejectMediaSchema), asyncHandler(async (req, res) => {
  const admin = res.locals.user as { id: string };
  const data = await rejectMedia(paramId(req.params.mediaId), admin.id, req.body.reason);
  res.json({ data });
}));

router.get('/media/:mediaId/download-url', optionalAuth, asyncHandler(async (req, res) => {
  const data = await getMediaDownloadUrl(paramId(req.params.mediaId), !!res.locals.profile);
  res.json({ data });
}));

router.delete('/media/:mediaId', requireAuth, asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const profile = res.locals.profile as { role: string };
  const data = await deleteMedia(paramId(req.params.mediaId), user.id, profile.role === 'admin');
  res.json({ data });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const listing = await getListing(paramId(req.params.id), false);
  const media = await listListingMedia(paramId(req.params.id), false);
  res.json({ data: { listing, media } });
}));

router.patch('/:id', requireAuth, requireRole('admin'), validateRequest(updateListingSchema), asyncHandler(async (req, res) => {
  const profile = res.locals.profile as { id: string; nom: string };
  const data = await updateListing(paramId(req.params.id), req.body);
  await logActivity({ agentId: profile.id, agentNom: profile.nom, typeAction: 'listing_updated', details: `Modifié: ${data.adresse}`, logementId: data.id });
  res.json({ data });
}));

router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const data = await softDeleteListing(paramId(req.params.id));
  res.json({ data });
}));

router.get('/:id/media', requireAuth, asyncHandler(async (req, res) => {
  const data = await listListingMedia(paramId(req.params.id), false);
  res.json({ data });
}));

router.put('/:id/media/order', requireAuth, validateRequest(reorderListingMediaSchema), asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const profile = res.locals.profile as { role: string };
  const data = await reorderListingMedia(
    paramId(req.params.id),
    req.body.mediaIds,
    user.id,
    profile.role === 'admin',
  );
  res.json({ data });
}));

router.post('/:id/media/upload-url', requireAuth, validateRequest(requestMediaUploadSchema), asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const data = await requestMediaUpload(paramId(req.params.id), user.id, req.body);
  res.json({ data });
}));

router.put(
  '/:id/media/:mediaId/file',
  requireAuth,
  raw({ type: () => true, limit: `${MAX_VIDEO_SIZE_MB}mb` }),
  asyncHandler(async (req, res) => {
    const user = res.locals.user as { id: string };
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const data = await uploadMediaFile(paramId(req.params.id), paramId(req.params.mediaId), user.id, body);
    res.json({ data });
  }),
);

router.post('/:id/media/:mediaId/complete', requireAuth, asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const profile = res.locals.profile as { nom: string };
  const data = await completeMediaUpload(paramId(req.params.id), paramId(req.params.mediaId), user.id);
  await logActivity({ agentId: user.id, agentNom: profile.nom, typeAction: 'media_uploaded', details: data.original_filename, logementId: paramId(req.params.id) });
  res.json({ data });
}));

export default router;
