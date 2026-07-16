import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { forbidden, notFound } from '../../utils/httpErrors.js';
import { assertSafeObjectKey } from '../../utils/objectKey.js';
import { isLocalStorage, openLocalObject } from './storage.service.js';

const router = Router();

const storageObjectQuerySchema = z.object({
  key: z.string()
    .min(1)
    .max(1024)
    .startsWith('listings/')
    .refine((value) => !value.includes('..') && !/[\u0000-\u001f\u007f]/.test(value)),
  inline: z.enum(['0', '1']).optional().default('0'),
  name: z.string().min(1).max(255).refine((value) => !/[\r\n"]/.test(value)).optional().default('file'),
}).strict();

router.get('/object', validateRequest(storageObjectQuerySchema, 'query'), optionalAuth, asyncHandler(async (req, res) => {
  if (!isLocalStorage()) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }

  const objectKey = String(req.query.key);
  assertSafeObjectKey(objectKey);
  const inline = req.query.inline === '1';
  const filename = String(req.query.name);

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
    inline ? 'inline' : `attachment; filename="${filename}"`,
  );
  openLocalObject(objectKey).pipe(res);
}));

export default router;
