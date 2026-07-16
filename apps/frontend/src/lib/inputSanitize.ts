const CONTROL_CHARS = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e]/g;
const ANGLE_BRACKETS = /[<>]/g;
const BACKTICK = /`/g;

export type FieldKind =
  | 'search'
  | 'plain'
  | 'address'
  | 'personName'
  | 'multiline'
  | 'phone'
  | 'email'
  | 'money'
  | 'decimal'
  | 'accessCode'
  | 'dateText'
  | 'dateIso';

function stripBase(value: string): string {
  return value.replace(CONTROL_CHARS, '').replace(/\0/g, '');
}

export function sanitizeFieldInput(value: string, kind: FieldKind, maxLength: number): string {
  let next = stripBase(value);

  switch (kind) {
    case 'search':
    case 'plain':
      next = next.replace(ANGLE_BRACKETS, '').replace(BACKTICK, '');
      break;
    case 'address':
      next = next.replace(ANGLE_BRACKETS, '').replace(BACKTICK, '');
      break;
    case 'personName':
      next = next.replace(/[^\p{L}\p{M}\s'.-]/gu, '');
      break;
    case 'multiline':
      next = next.replace(ANGLE_BRACKETS, '').replace(BACKTICK, '');
      break;
    case 'phone':
      next = next.replace(/[^\d+().\-\s]/g, '');
      break;
    case 'email':
      next = next.toLowerCase().replace(/[^\w.!#$%&'*+/=?^`{|}~@\-]/g, '');
      break;
    case 'money':
      next = next.replace(/[^\d]/g, '');
      break;
    case 'decimal': {
      next = next.replace(/[^\d.\-]/g, '');
      const negative = next.startsWith('-');
      const body = next.replace(/-/g, '');
      const [whole, ...rest] = body.split('.');
      next = `${negative ? '-' : ''}${whole}${rest.length ? `.${rest.join('')}` : ''}`;
      break;
    }
    case 'accessCode':
      next = next.replace(/[^a-zA-Z0-9#*\-]/g, '');
      break;
    case 'dateText':
      next = next.replace(/[^\d/\-.]/g, '');
      break;
    case 'dateIso':
      next = next.replace(/[^\d-]/g, '').slice(0, 10);
      break;
    default:
      break;
  }

  return next.slice(0, maxLength);
}

export function normalizePhoneForApi(value: string): string {
  return sanitizeFieldInput(value, 'phone', 30).replace(/\D/g, '').slice(0, 15);
}

export function sanitizeListingFormFields(form: {
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
  return {
    adresse: sanitizeFieldInput(form.adresse, 'address', 500).trim(),
    quartier: sanitizeFieldInput(form.quartier, 'plain', 120).trim(),
    prix: sanitizeFieldInput(form.prix, 'money', 6),
    taille: form.taille,
    statut: form.statut,
    electromenagers: sanitizeFieldInput(form.electromenagers, 'plain', 1000).trim(),
    code_entree: sanitizeFieldInput(form.code_entree, 'accessCode', 200).trim(),
    concierge_tel: normalizePhoneForApi(form.concierge_tel),
    notes: sanitizeFieldInput(form.notes, 'multiline', 10000).trim(),
    latitude: sanitizeFieldInput(form.latitude, 'decimal', 20),
    longitude: sanitizeFieldInput(form.longitude, 'decimal', 20),
  };
}

export function sanitizeCreateUserFields(input: {
  nom: string;
  email: string;
  telephone: string;
  password: string;
  role: string;
}) {
  return {
    nom: sanitizeFieldInput(input.nom, 'personName', 120).trim(),
    email: sanitizeFieldInput(input.email, 'email', 320).trim(),
    telephone: input.telephone.trim() ? normalizePhoneForApi(input.telephone) : '',
    password: input.password,
    role: input.role,
  };
}

export function sanitizeCommentText(value: string): string {
  return sanitizeFieldInput(value, 'multiline', 5000).trim();
}

import type { InputHTMLAttributes } from 'react';

export function fieldInputAttributes(kind: FieldKind): {
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  pattern?: string;
} {
  switch (kind) {
    case 'phone':
      return { type: 'tel', inputMode: 'tel', pattern: '[0-9+().\\-\\s]*', autoComplete: 'tel' };
    case 'email':
      return { type: 'email', inputMode: 'email', autoComplete: 'email' };
    case 'money':
      return { type: 'text', inputMode: 'numeric', pattern: '[0-9]*' };
    case 'decimal':
      return { type: 'text', inputMode: 'decimal', pattern: '-?[0-9]*\\.?[0-9]*' };
    case 'dateIso':
      return { type: 'date' };
    case 'search':
      return { type: 'search', inputMode: 'search' };
    case 'personName':
      return { type: 'text', inputMode: 'text', autoComplete: 'name' };
    case 'accessCode':
      return { type: 'text', inputMode: 'text', pattern: '[a-zA-Z0-9#*\\-]*' };
    case 'dateText':
      return { type: 'text', inputMode: 'numeric', pattern: '[0-9/\\-.]*' };
    default:
      return { type: 'text', inputMode: 'text' };
  }
}
