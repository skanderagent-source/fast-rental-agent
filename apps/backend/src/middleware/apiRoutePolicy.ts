import type { NextFunction, Request, Response } from 'express';

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RoutePolicy = {
  pattern: RegExp;
  methods: HttpMethod[];
};

const id = '[^/]+';
const route = (pattern: string, methods: HttpMethod[]): RoutePolicy => ({
  pattern: new RegExp(`^${pattern}/?$`),
  methods: methods.includes('GET') && !methods.includes('HEAD')
    ? [...methods, 'HEAD']
    : methods,
});

/**
 * Explicit API method registry. Add every new route here when adding it to an
 * Express router. This lets the boundary reject invalid preflights and return
 * a consistent 405 instead of allowing method probing to fall through.
 */
const API_ROUTE_POLICIES: RoutePolicy[] = [
  route('/me', ['GET', 'PATCH']),
  route('/me/email', ['PATCH']),
  route('/me/action-token', ['POST']),
  route('/me/activity/login', ['POST']),
  route('/me/password-updated', ['POST']),

  route('/users', ['GET', 'POST']),
  route(`/users/${id}`, ['PATCH', 'DELETE']),
  route(`/users/${id}/referral-slug`, ['PATCH']),
  route(`/users/${id}/deactivate`, ['POST']),
  route(`/users/${id}/reactivate`, ['POST']),

  route('/listings', ['GET', 'POST']),
  route('/listings/map', ['GET']),
  route('/listings/me/media', ['GET']),
  route('/listings/me/profile-photo/upload-url', ['POST']),
  route(`/listings/me/profile-photo/${id}/complete`, ['POST']),
  route(`/listings/media/${id}/approve`, ['POST']),
  route(`/listings/media/${id}/reject`, ['POST']),
  route(`/listings/media/${id}/download-url`, ['GET']),
  route(`/listings/media/${id}`, ['DELETE']),
  route(`/listings/${id}`, ['GET', 'PATCH', 'DELETE']),
  route(`/listings/${id}/media`, ['GET']),
  route(`/listings/${id}/media/order`, ['PUT']),
  route(`/listings/${id}/media/upload-url`, ['POST']),
  route(`/listings/${id}/media/${id}/file`, ['PUT']),
  route(`/listings/${id}/media/${id}/complete`, ['POST']),

  route('/leads', ['GET']),
  route('/leads/my-calls', ['GET']),
  route(`/leads/${id}/assign`, ['POST']),
  route(`/leads/${id}/progress`, ['PATCH']),
  route(`/leads/${id}`, ['DELETE']),

  route(`/comments/listings/${id}/comments`, ['GET', 'POST']),
  route(`/comments/${id}`, ['DELETE']),

  route('/admin/stats', ['GET']),
  route('/admin/agents/stats', ['GET']),
  route('/admin/media/pending', ['GET']),
  route('/admin/activity', ['GET']),
  route('/admin/sheets/preview', ['GET']),
  route('/admin/sheets/import', ['POST']),
  route('/admin/sheets/sync', ['POST']),
  route('/admin/geocode/run', ['POST']),
  route('/admin/sheets/runs', ['GET']),
  route('/admin/email/test', ['POST']),

  route('/rentals/me', ['GET']),
  route('/rentals', ['POST']),

  route('/public/listings', ['GET']),
  route(`/public/listings/${id}`, ['GET']),
  route('/storage/object', ['GET']),
];

const PREFLIGHT_HEADERS = new Set(['authorization', 'content-type', 'x-action-token']);

function allowedMethods(path: string): HttpMethod[] | null {
  return API_ROUTE_POLICIES.find((policy) => policy.pattern.test(path))?.methods ?? null;
}

function methodNotAllowed(res: Response, methods: HttpMethod[]) {
  res.setHeader('Allow', [...methods, 'OPTIONS'].join(', '));
  return res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Méthode HTTP non autorisée' },
  });
}

export function enforceApiRoutePolicy(req: Request, res: Response, next: NextFunction) {
  const methods = allowedMethods(req.path);
  if (!methods) {
    if (req.method === 'OPTIONS') return apiNotFound(req, res);
    return next();
  }

  if (req.method === 'OPTIONS') {
    const origin = req.get('origin');
    const requestedMethod = req.get('access-control-request-method')?.toUpperCase() as HttpMethod | undefined;
    if (!origin || !requestedMethod) {
      return res.status(400).json({
        error: { code: 'INVALID_PREFLIGHT', message: 'Pré-vérification CORS invalide' },
      });
    }
    if (!methods.includes(requestedMethod)) return methodNotAllowed(res, methods);

    const requestedHeaders = (req.get('access-control-request-headers') ?? '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    if (requestedHeaders.some((header) => !PREFLIGHT_HEADERS.has(header))) {
      return res.status(400).json({
        error: { code: 'INVALID_PREFLIGHT', message: 'En-tête CORS non autorisé' },
      });
    }
    return next();
  }

  if (!methods.includes(req.method as HttpMethod)) {
    return methodNotAllowed(res, methods);
  }

  return next();
}

export function apiNotFound(_req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route API introuvable' },
  });
}
