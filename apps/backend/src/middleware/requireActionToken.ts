import type { SensitiveAction } from '@fast-rental/shared';
import type { NextFunction, Request, Response } from 'express';
import { consumeActionToken } from '../modules/auth/actionTokens.service.js';
import { logSecurityEvent, securityContextFromRequest } from '../utils/securityLog.js';

const ACTION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function requireActionToken(action: SensitiveAction, targetParam?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.get('x-action-token') ?? '';
      const userId = (res.locals.user as { id?: string } | undefined)?.id;
      const rawTargetId = targetParam ? req.params[targetParam] : undefined;
      const targetId = Array.isArray(rawTargetId) ? rawTargetId[0] : rawTargetId;
      if (!userId || !ACTION_TOKEN_PATTERN.test(token)) {
        logSecurityEvent({
          event: 'action_token_failure',
          ...securityContextFromRequest(req),
          userId,
          outcome: 'denied',
          reason: 'action_token_missing',
          statusCode: 403,
        });
        return res.status(403).json({
          error: { code: 'ACTION_TOKEN_REQUIRED', message: 'Confirmation de sécurité requise' },
        });
      }
      const consumed = await consumeActionToken(token, userId, action, targetId);
      if (!consumed) {
        logSecurityEvent({
          event: 'action_token_failure',
          ...securityContextFromRequest(req),
          userId,
          outcome: 'denied',
          reason: 'action_token_invalid',
          statusCode: 403,
        });
        return res.status(403).json({
          error: { code: 'ACTION_TOKEN_INVALID', message: 'Confirmation invalide ou expirée' },
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
