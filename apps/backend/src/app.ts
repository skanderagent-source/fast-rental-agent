import compression from 'compression';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { apiNotFound, enforceApiRoutePolicy } from './middleware/apiRoutePolicy.js';
import { enforceHttps } from './middleware/enforceHttps.js';
import { errorHandler } from './middleware/errorHandler.js';
import {
  rejectDuplicateQueryParameters,
  rejectPrototypePollution,
} from './middleware/inputSafety.js';
import { enforceRequestBoundary } from './middleware/requestBoundary.js';
import { preventPrivateResponseCaching } from './middleware/preventPrivateResponseCaching.js';
import { rejectCompressedRequestBody } from './middleware/rejectCompressedRequestBody.js';
import { attachRequestId } from './middleware/requestId.js';
import apiRoutes from './routes/index.js';
import { attachRetryAfterHeader } from './utils/rateLimitResponse.js';
import { logSecurityEvent, securityContextFromRequest } from './utils/securityLog.js';

export const app = express();

// Production Caddy connects over loopback; never trust arbitrary client proxy headers.
app.set('trust proxy', 'loopback');
app.set('query parser', 'simple');
app.set('json escape', true);
app.disable('x-powered-by');

app.use(attachRequestId);
app.use(pinoHttp({
  logger,
  genReqId: (req) => (req as import('express').Request).requestId ?? randomUUID(),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-action-token"]',
      'req.headers["set-cookie"]',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.token',
      'req.body.refreshToken',
      'req.body.accessToken',
      'req.body.code',
    ],
    censor: '[Redacted]',
  },
}));
app.use(enforceRequestBoundary);
app.use(rejectDuplicateQueryParameters);
app.use(enforceHttps);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

const allowedOrigins = new Set(env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()));
const apiCors = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Action-Token'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  credentials: false,
  maxAge: 600,
  optionsSuccessStatus: 204,
});

app.use(compression({
  filter(req, res) {
    const path = req.path;
    if (path.startsWith('/api') && !path.startsWith('/api/public')) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
app.use(rejectCompressedRequestBody);
app.use(express.json({ limit: '2mb', strict: true, type: 'application/json' }));
app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 50 }));
app.use(express.text({ type: 'text/plain', limit: '64kb' }));
app.use(rejectPrototypePollution);

const rateLimitHandler = (
  req: import('express').Request,
  res: import('express').Response,
  _next: import('express').NextFunction,
  options: { statusCode: number },
) => {
  logSecurityEvent({
    event: 'rate_limit_exceeded',
    ...securityContextFromRequest(req),
    outcome: 'blocked',
    reason: req.originalUrl.startsWith('/api/public') ? 'public_rate_limit' : 'api_rate_limit',
    statusCode: options.statusCode,
  });
  attachRetryAfterHeader(req, res);
  res.status(options.statusCode).json({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes. Réessayez plus tard.',
    },
  });
};

const publicLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_PUBLIC_WINDOW_MS,
  max: env.RATE_LIMIT_PUBLIC_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
  max: env.RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith('/api/public'),
  handler: rateLimitHandler,
});

app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true });
});

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
  app.use('/api/public', publicLimiter);
}

app.use('/api', preventPrivateResponseCaching, enforceApiRoutePolicy, apiCors);
app.use('/api', apiRoutes);
app.use('/api', apiNotFound);

app.use(errorHandler);
