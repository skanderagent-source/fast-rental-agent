import { env } from '../config/env.js';

export function redactedEmailRecipient(email: string) {
  if (env.NODE_ENV !== 'production') return { to: email };
  const [, domain = 'unknown'] = email.split('@');
  return { toDomain: domain.toLowerCase() };
}
