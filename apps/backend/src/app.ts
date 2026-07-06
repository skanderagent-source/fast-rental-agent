import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

export const app = express();

app.set('trust proxy', 1);

app.use(pinoHttp({ logger }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: env.FRONTEND_ORIGIN.split(',').map((o) => o.trim()),
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

const publicLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_PUBLIC_WINDOW_MS,
  max: env.RATE_LIMIT_PUBLIC_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/public', publicLimiter);
app.use('/api', apiRoutes);

app.use(errorHandler);
