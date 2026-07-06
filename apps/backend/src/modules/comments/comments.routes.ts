import { Router } from 'express';
import { createCommentSchema } from '@fast-rental/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { paramId } from '../../utils/params.js';
import { createComment, deleteComment, listComments } from './comments.service.js';

const router = Router();

router.get('/listings/:id/comments', requireAuth, asyncHandler(async (req, res) => {
  const data = await listComments(paramId(req.params.id));
  res.json({ data });
}));

router.post('/listings/:id/comments', requireAuth, validateRequest(createCommentSchema), asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const profile = res.locals.profile as { nom: string };
  const data = await createComment(paramId(req.params.id), user.id, profile.nom, req.body.texte);
  res.json({ data });
}));

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const user = res.locals.user as { id: string };
  const profile = res.locals.profile as { role: string };
  const data = await deleteComment(paramId(req.params.id), user.id, profile.role === 'admin');
  res.json({ data });
}));

export default router;
