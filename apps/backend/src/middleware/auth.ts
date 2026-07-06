import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../db/supabaseAdmin.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid session' } });
  }
  const { data: profile } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (!profile) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Profil introuvable' } });
  }
  if (!profile.actif) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Compte désactivé' } });
  }
  res.locals.user = data.user;
  res.locals.profile = profile;
  next();
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return next();
  const { data: profile } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (profile?.actif) {
    res.locals.user = data.user;
    res.locals.profile = profile;
  }
  next();
}
