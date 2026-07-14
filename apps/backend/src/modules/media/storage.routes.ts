import { Router } from 'express';
import { optionalAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { forbidden, notFound } from '../../utils/httpErrors.js';
import { isLocalStorage, openLocalObject } from './storage.service.js';

const router = Router();

router.get('/object', optionalAuth, asyncHandler(async (req, res) => {
  if (!isLocalStorage()) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }

  const objectKey = String(req.query.key ?? '');
  const inline = req.query.inline === '1';
  const filename = String(req.query.name ?? 'file');
  if (!objectKey) throw notFound('Fichier introuvable');

  const { data: media } = await supabaseAdmin
    .from('listing_media')
    .select('status, mime_type, upload_completed_at')
    .eq('object_key', objectKey)
    .maybeSingle();

  if (!media?.upload_completed_at) throw notFound('Fichier introuvable');

  const isAuthenticated = !!res.locals.profile;
  if (!isAuthenticated && media.status !== 'approved') {
    throw forbidden('Média non public');
  }

  res.setHeader('Content-Type', media.mime_type ?? 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    inline ? 'inline' : `attachment; filename="${filename.replace(/"/g, '')}"`,
  );
  openLocalObject(objectKey).pipe(res);
}));

export default router;
