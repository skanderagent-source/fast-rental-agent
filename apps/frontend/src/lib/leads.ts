import type { Lead } from '@fast-rental/shared';

const SYSTEM_MESSAGE_PREFIXES = [
  /^Type:\s/m,
  /^Logement:\s/m,
  /^Revenu mensuel:\s/m,
  /^Cote de crédit:\s/m,
  /^Dossier TAL:\s/m,
  /^Date déménagement:\s/m,
];

export function leadTypeLabel(typeDemande: Lead['type_demande']) {
  return typeDemande === 'prequal' ? 'Préqualification' : 'Rappel rapide';
}

export function traitementStatutLabel(statut: string) {
  if (statut === 'réglé') return 'Réglé';
  if (statut === 'refusé') return 'Refusé';
  if (statut === 'contacté') return 'Contacté';
  if (statut === 'assigné') return 'Assigné';
  return statut;
}

export function parseDossierTal(message: string | null | undefined): boolean | null {
  if (!message) return null;
  const match = message.match(/^Dossier TAL:\s*(Oui|Non)/m);
  if (!match) return null;
  return match[1] === 'Oui';
}

export function extractUserMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const lines = message.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return !SYSTEM_MESSAGE_PREFIXES.some((prefix) => prefix.test(line));
  });
  const text = lines.join('\n').trim();
  return text || null;
}

export function formatLeadCurrency(value: number | null | undefined) {
  if (value == null) return null;
  return `${value.toLocaleString('fr-CA')}$`;
}
