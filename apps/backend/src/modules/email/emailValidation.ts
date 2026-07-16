import { z } from 'zod';
import { safeEmailHeader } from './templates.js';

const emailAddressSchema = z.string().trim().email().max(320);

export function parseRecipientEmail(raw: string): string {
  if (/[\r\n\u0000]/.test(raw)) {
    throw Object.assign(new Error('Adresse email invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  const parsed = emailAddressSchema.safeParse(raw);
  if (!parsed.success) {
    throw Object.assign(new Error('Adresse email invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  return parsed.data;
}

export function parseConfiguredReplyTo(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const parsed = emailAddressSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function sanitizeEmailSubject(subject: string): string {
  return safeEmailHeader(subject);
}

export function sanitizeEmailBodyText(value: string): string {
  return value.replace(/[\u0000]/g, '');
}
