import { describe, expect, it } from 'vitest';
import {
  extractUserMessage,
  leadTypeLabel,
  parseDossierTal,
} from './leads';

describe('lead display helpers', () => {
  it('labels Union Rental lead types', () => {
    expect(leadTypeLabel('rappel')).toBe('Rappel rapide');
    expect(leadTypeLabel('prequal')).toBe('Préqualification');
  });

  it('parses dossier TAL from composed Union Rental message', () => {
    const message = [
      'Type: Préqualification',
      'Logement: 100 Rue Test',
      'Revenu mensuel: 3500$',
      'Cote de crédit: 720',
      'Dossier TAL: Oui',
      'Date déménagement: 2026-08-01',
      'Famille de 3',
    ].join('\n');
    expect(parseDossierTal(message)).toBe(true);
    expect(extractUserMessage(message)).toBe('Famille de 3');
  });

  it('returns null user message when only system lines are present', () => {
    expect(extractUserMessage('Type: Rappel rapide\nLogement: 111 Erables Apt.16')).toBeNull();
  });
});
