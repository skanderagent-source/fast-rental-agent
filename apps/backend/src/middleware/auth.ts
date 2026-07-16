import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../db/supabaseAdmin.js';
import { hasDisallowedJwtHeader } from '../utils/jwtValidation.js';
import { logSecurityEvent, securityContextFromRequest } from '../utils/securityLog.js';

function setAuthLocals(res: Response, user: unknown, profile: unknown) {
  res.locals.user = user;
  res.locals.profile = profile;
}

function denyAuth(
  req: Request,
  res: Response,
  statusCode: 401 | 403,
  code: string,
  message: string,
  event: 'auth_failure' | 'account_inactive',
  reason: string,
) {
  logSecurityEvent({
    event,
    ...securityContextFromRequest(req),
    outcome: 'denied',
    reason,
    statusCode,
  });
  return res.status(statusCode).json({ error: { code, message } });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return denyAuth(req, res, 401, 'UNAUTHORIZED', 'Missing token', 'auth_failure', 'missing_token');
  }
  if (hasDisallowedJwtHeader(token)) {
    return denyAuth(
      req,
      res,
      401,
      'UNAUTHORIZED',
      'Invalid session',
      'auth_failure',
      'disallowed_jwt_header',
    );
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return denyAuth(req, res, 401, 'UNAUTHORIZED', 'Invalid session', 'auth_failure', 'invalid_session');
  }
  const { data: profile } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (!profile) {
    return denyAuth(req, res, 403, 'FORBIDDEN', 'Profil introuvable', 'auth_failure', 'missing_profile');
  }
  if (!profile.actif) {
    return denyAuth(
      req,
      res,
      403,
      'FORBIDDEN',
      'Compte désactivé',
      'account_inactive',
      'inactive_account',
    );
  }
  setAuthLocals(res, data.user, profile);
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
    setAuthLocals(res, data.user, profile);
  }
  next();
}
