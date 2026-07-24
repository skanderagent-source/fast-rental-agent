import {
  createCommentSchema,
  createListingSchema,
  createUserSchema,
  loginEmailSchema,
  passwordSchema,
  updateListingSchema,
  updateProfileSchema,
  uuidParamSchema,
} from '@fast-rental/shared';
import type { ZodIssue } from 'zod';
import {
  normalizePhoneForApi,
  sanitizeCommentText,
  sanitizeCreateUserFields,
  sanitizeFieldInput,
  sanitizeListingFormFields,
} from './inputSanitize';

// Client-side validation improves UX only. The VPS API remains the security boundary.
export function formatZodIssues(issues: ZodIssue[]): string {
  return issues[0]?.message ?? 'Données invalides';
}

export function parseRouteId(id: string | undefined): string | null {
  const parsed = uuidParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export function parseLoginEmail(email: string): string | null {
  const cleaned = sanitizeFieldInput(email, 'email', 320).trim();
  const parsed = loginEmailSchema.safeParse(cleaned);
  return parsed.success ? parsed.data : null;
}

export function parseEmailChange(email: string) {
  return loginEmailSchema.safeParse(sanitizeFieldInput(email, 'email', 320).trim());
}

export function parsePasswordPair(pw1: string, pw2: string): string | null {
  const first = passwordSchema.safeParse(pw1);
  if (!first.success) return formatZodIssues(first.error.issues);
  if (pw1 !== pw2) return 'Les mots de passe ne correspondent pas';
  return null;
}

export function parseListingCreatePayload(form: {
  adresse: string;
  quartier: string;
  prix: string;
  taille: string;
  statut: string;
  electromenagers: string;
  code_entree: string;
  concierge_tel: string;
  notes: string;
  latitude: string;
  longitude: string;
}) {
  const cleaned = sanitizeListingFormFields(form);
  return createListingSchema.safeParse({
    adresse: cleaned.adresse,
    quartier: cleaned.quartier || null,
    prix: cleaned.prix === '' ? null : cleaned.prix,
    taille: cleaned.taille || null,
    statut: cleaned.statut,
    electromenagers: cleaned.electromenagers || null,
    code_entree: cleaned.code_entree || null,
    concierge_tel: cleaned.concierge_tel || null,
    notes: cleaned.notes || null,
    latitude: cleaned.latitude === '' ? null : cleaned.latitude,
    longitude: cleaned.longitude === '' ? null : cleaned.longitude,
  });
}

export function parseListingUpdatePayload(form: Parameters<typeof parseListingCreatePayload>[0]) {
  const parsed = parseListingCreatePayload(form);
  if (!parsed.success) return parsed;
  return updateListingSchema.safeParse(parsed.data);
}

export function parseCreateUserPayload(input: {
  nom: string;
  email: string;
  role: string;
}) {
  const cleaned = sanitizeCreateUserFields(input);
  return createUserSchema.safeParse({
    nom: cleaned.nom,
    email: cleaned.email,
    role: cleaned.role,
  });
}

export function parsePhoneUpdate(telephone: string) {
  const normalized = normalizePhoneForApi(telephone);
  return updateProfileSchema.pick({ telephone: true }).safeParse({ telephone: normalized });
}

export function parseCommentPayload(texte: string) {
  return createCommentSchema.safeParse({ texte: sanitizeCommentText(texte) });
}

export function formatCurrency(value: string): string | null {
  const trimmed = sanitizeFieldInput(value, 'money', 6);
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return `$${amount.toLocaleString('fr-CA')}`;
}
