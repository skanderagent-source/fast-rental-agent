import type { NextFunction, Request, Response } from 'express';
import { logSecurityEvent, securityContextFromRequest } from '../utils/securityLog.js';

export const PERMISSIONS = [
  'admin.dashboard.read',
  'users.manage',
  'listings.manage',
  'media.moderate',
  'leads.assign',
  'leads.delete',
  'sheets.manage',
  'geocoding.manage',
  'email.test',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
type AppRole = 'admin' | 'agent';

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS),
  agent: new Set(),
};

function profileRole(res: Response): AppRole | null {
  const role = (res.locals.profile as { role?: unknown } | undefined)?.role;
  return role === 'admin' || role === 'agent' ? role : null;
}

function denyAuthz(
  req: Request,
  res: Response,
  statusCode: 401 | 403,
  code: string,
  message: string,
  reason: string,
) {
  const userId = (res.locals.user as { id?: string } | undefined)?.id;
  logSecurityEvent({
    event: 'authz_failure',
    ...securityContextFromRequest(req),
    userId,
    outcome: 'denied',
    reason,
    statusCode,
  });
  return res.status(statusCode).json({ error: { code, message } });
}

export function requireRole(role: 'admin' | 'agent') {
  return (req: Request, res: Response, next: NextFunction) => {
    const actualRole = profileRole(res);
    if (!actualRole) {
      return denyAuthz(req, res, 401, 'UNAUTHORIZED', 'Missing profile', 'missing_profile');
    }
    if (actualRole !== role) {
      return denyAuthz(req, res, 403, 'FORBIDDEN', `Role ${role} required`, 'role_mismatch');
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = profileRole(res);
    if (!role) {
      return denyAuthz(req, res, 401, 'UNAUTHORIZED', 'Missing profile', 'missing_profile');
    }
    if (!ROLE_PERMISSIONS[role].has(permission)) {
      return denyAuthz(req, res, 403, 'FORBIDDEN', 'Permission refusée', 'permission_denied');
    }
    next();
  };
}
