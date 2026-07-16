import { useEffect, useState } from 'react';
import { parseTraitementStatut, TRAITEMENT_STATUTS, type LeadListItem, type TraitementStatut } from '@fast-rental/shared';
import { api, ApiError } from '../../lib/apiClient';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/ToastProvider';

type Props = {
  lead: LeadListItem;
  onUpdated: () => void;
};

export function LeadProgressControl({ lead, onUpdated }: Props) {
  const toast = useToast();
  const saved = parseTraitementStatut(lead.traitement_statut);
  const [selected, setSelected] = useState<TraitementStatut>(saved);
  const [confirmArchive, setConfirmArchive] = useState<'réglé' | 'refusé' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelected(saved);
  }, [saved, lead.id]);

  const address = lead.listing_adresse ?? 'ce logement';
  const changed = selected !== saved;

  async function submitStatus(status: TraitementStatut) {
    setSubmitting(true);
    try {
      await api.patch(`/api/leads/${lead.id}/progress`, { traitementStatut: status });
      onUpdated();
      toast('✅ Statut mis à jour');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Mise à jour impossible';
      toast(`⚠️ ${message}`);
    } finally {
      setSubmitting(false);
      setConfirmArchive(null);
    }
  }

  function handleConfirmClick() {
    if (!changed || submitting) return;
    if (selected === 'réglé' || selected === 'refusé') {
      setConfirmArchive(selected);
      return;
    }
    void submitStatus(selected);
  }

  const archiveMessage = confirmArchive === 'réglé'
    ? <>L&apos;appartement <strong>{address}</strong> sera classé comme réglé.</>
    : confirmArchive === 'refusé'
      ? <>L&apos;appartement <strong>{address}</strong> sera classé comme refusé.</>
      : null;

  return (
    <div className="form-field demande-card__progress">
      <label htmlFor={`progress-${lead.id}`}>Statut de traitement</label>
      <select
        id={`progress-${lead.id}`}
        value={selected}
        disabled={submitting}
        onChange={(e) => {
          const value = e.target.value;
          if ((TRAITEMENT_STATUTS as readonly string[]).includes(value)) {
            setSelected(value as TraitementStatut);
          }
        }}
      >
        <option value="assigné">Assigné</option>
        <option value="contacté">Contacté</option>
        <option value="réglé">Réglé</option>
        <option value="refusé">Refusé</option>
      </select>
      <div className="demande-card__progress-actions">
        <button
          type="button"
          className="profile-btn profile-btn--primary demande-card__progress-confirm"
          disabled={!changed || submitting}
          onClick={handleConfirmClick}
        >
          {submitting ? 'Envoi…' : 'Confirmer'}
        </button>
      </div>
      <ConfirmDialog
        open={confirmArchive !== null}
        message={archiveMessage}
        cancelLabel="Annuler"
        confirmLabel="Confirmer"
        confirmTone="primary"
        onCancel={() => setConfirmArchive(null)}
        onConfirm={() => void submitStatus(confirmArchive!)}
      />
    </div>
  );
}
