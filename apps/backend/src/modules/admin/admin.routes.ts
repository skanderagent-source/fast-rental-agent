import { Router } from 'express';
import { adminTestEmailSchema } from '@fast-rental/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requireActionToken } from '../../middleware/requireActionToken.js';
import { requirePermission } from '../../middleware/requireRole.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logger } from '../../config/logger.js';
import {
  getAdminStats,
  getAgentStats,
  getPendingMedia,
  getRecentActivity,
  sendTestEmail,
} from './admin.service.js';
import { syncAllSheets, getSheetRuns, previewSheetImport, importSheetsFromGoogle } from '../sheets/sheets.service.js';
import { geocodeAllPendingListings } from '../listings/listings.geocode.js';

const router = Router();

router.get('/stats', requireAuth, requirePermission('admin.dashboard.read'), asyncHandler(async (_req, res) => {
  const data = await getAdminStats();
  res.json({ data });
}));

router.get('/agents/stats', requireAuth, requirePermission('admin.dashboard.read'), asyncHandler(async (_req, res) => {
  const data = await getAgentStats();
  res.json({ data });
}));

router.get('/media/pending', requireAuth, requirePermission('media.moderate'), asyncHandler(async (_req, res) => {
  const data = await getPendingMedia();
  res.json({ data });
}));

router.get('/activity', requireAuth, requirePermission('admin.dashboard.read'), asyncHandler(async (_req, res) => {
  const data = await getRecentActivity();
  res.json({ data });
}));

router.get('/sheets/preview', requireAuth, requirePermission('sheets.manage'), asyncHandler(async (_req, res) => {
  const data = await previewSheetImport();
  res.json({ data });
}));

router.post('/sheets/import', requireAuth, requirePermission('sheets.manage'), requireActionToken('sheets.import'), asyncHandler(async (_req, res) => {
  const data = await importSheetsFromGoogle();
  res.json({ data });
}));

router.post('/sheets/sync', requireAuth, requirePermission('sheets.manage'), requireActionToken('sheets.sync'), asyncHandler(async (_req, res) => {
  const data = await syncAllSheets();
  res.json({ data });
}));

router.post('/geocode/run', requireAuth, requirePermission('geocoding.manage'), asyncHandler(async (_req, res) => {
  void geocodeAllPendingListings(true)
    .then((result) => logger.info(result, 'Admin-triggered batch geocoding finished'))
    .catch((err) => logger.error({ err }, 'Admin-triggered batch geocoding failed'));

  res.status(202).json({
    data: {
      status: 'started',
      message: 'Géocodage en cours en arrière-plan. Pour un rapport complet, utilisez npm run geocode sur le VPS.',
    },
  });
}));

router.get('/sheets/runs', requireAuth, requirePermission('sheets.manage'), asyncHandler(async (_req, res) => {
  const data = await getSheetRuns();
  res.json({ data });
}));

router.post('/email/test', requireAuth, requirePermission('email.test'), validateRequest(adminTestEmailSchema), asyncHandler(async (req, res) => {
  const to = req.body.to ?? (res.locals.profile as { email: string }).email;
  const data = await sendTestEmail(to);
  res.json({ data });
}));

export default router;
