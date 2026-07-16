import type { Request } from 'express';
import { logger } from '../config/logger.js';

export type SecurityEventType =
  | 'auth_failure'
  | 'authz_failure'
  | 'rate_limit_exceeded'
  | 'action_token_failure'
  | 'account_inactive';

export type SecurityEvent = {
  event: SecurityEventType;
  requestId?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  outcome: 'denied' | 'blocked';
  reason: string;
  statusCode: number;
};

export function securityContextFromRequest(req: Request) {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

export function logSecurityEvent(event: SecurityEvent) {
  logger.warn({ security: event }, 'security_event');
}
