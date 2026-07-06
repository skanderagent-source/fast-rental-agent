import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import listingsRoutes from '../modules/listings/listings.routes.js';
import leadsRoutes from '../modules/leads/leads.routes.js';
import commentsRoutes from '../modules/comments/comments.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import rentalsRoutes from '../modules/rentals/rentals.routes.js';
import publicRoutes from './public.routes.js';

const router = Router();

router.use('/me', authRoutes);
router.use('/users', usersRoutes);
router.use('/listings', listingsRoutes);
router.use('/leads', leadsRoutes);
router.use('/comments', commentsRoutes);
router.use('/admin', adminRoutes);
router.use('/rentals', rentalsRoutes);
router.use('/public', publicRoutes);

export default router;
