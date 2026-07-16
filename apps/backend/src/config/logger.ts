import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'SUPABASE_SERVICE_ROLE_KEY',
      'R2_SECRET_ACCESS_KEY',
      'RESEND_API_KEY',
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      'err.config.headers.Authorization',
      'err.config.headers.authorization',
      'err.response.config.headers.Authorization',
      'err.response.config.headers.authorization',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.accessToken',
      '*.refreshToken',
      '*.authorization',
      '*.service_role_key',
      '*.secret_access_key',
      '*.api_key',
    ],
    censor: '[Redacted]',
  },
});
