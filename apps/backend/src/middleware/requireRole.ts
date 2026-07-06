import type { NextFunction, Request, Response } from 'express';

export function requireRole(role: 'admin' | 'agent') {
  return (_req: Request, res: Response, next: NextFunction) => {
    const profile = res.locals.profile as { role?: string } | undefined;
    if (!profile) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing profile' } });
    }
    if (role === 'admin' && profile.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only' } });
    }
    next();
  };
}
