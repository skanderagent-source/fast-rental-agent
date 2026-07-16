import { parseLoginEmail, parsePasswordPair } from '../../lib/formValidation';

export function validateLogin(email: string, password: string): string | null {
  if (!parseLoginEmail(email)) return 'Email invalide';
  if (!password) return 'Mot de passe requis';
  return null;
}

export function validatePasswordPair(pw1: string, pw2: string): string | null {
  return parsePasswordPair(pw1, pw2);
}
