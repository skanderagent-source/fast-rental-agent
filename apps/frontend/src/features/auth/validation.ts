export function validateLogin(email: string, password: string): string | null {
  if (!email.trim()) return 'Email requis';
  if (!password) return 'Mot de passe requis';
  return null;
}

export function validatePasswordPair(pw1: string, pw2: string, minLength = 6): string | null {
  if (pw1.length < minLength) return `Minimum ${minLength} caractères`;
  if (pw1 !== pw2) return 'Les mots de passe ne correspondent pas';
  return null;
}
