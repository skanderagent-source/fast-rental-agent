import { useEffect, useState } from 'react';
import { buildFacebookAd } from '@fast-rental/shared';
import type { Listing } from '@fast-rental/shared';
import { Modal } from '../common/Modal';
import { SanitizedInput, SanitizedTextarea } from '../common/SanitizedField';
import { copyTextToClipboard } from '../../lib/clipboard';
import { sanitizeFieldInput } from '../../lib/inputSanitize';

type Props = {
  open: boolean;
  listing: Listing | null;
  onClose: () => void;
  onCopied: () => void;
};

export function FacebookAdModal({ open, listing, onClose, onCopied }: Props) {
  const [dispo, setDispo] = useState('');
  const [extras, setExtras] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (listing) setExtras(sanitizeFieldInput(listing.notes ?? '', 'multiline', 10000));
  }, [listing]);

  async function submit() {
    if (!listing) return;
    setError('');
    const msg = buildFacebookAd(listing, dispo, extras);
    try {
      await copyTextToClipboard(msg);
      onCopied();
      onClose();
    } catch {
      setError('Impossible de copier le texte. Vérifie les permissions du presse-papiers.');
    }
  }

  return (
    <Modal
      open={open}
      title="Générer annonce Facebook"
      onClose={onClose}
      footer={<button className="btn-add" type="button" onClick={() => void submit()}>Copier l'annonce</button>}
    >
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div className="form-field">
        <label htmlFor="fb-dispo">Date de disponibilité</label>
        <SanitizedInput id="fb-dispo" kind="dateText" maxLength={20} value={dispo} onChange={setDispo} />
      </div>
      <div className="form-field" style={{ marginTop: 10 }}>
        <label htmlFor="fb-extras">Extras (optionnel)</label>
        <SanitizedTextarea id="fb-extras" kind="multiline" maxLength={10000} value={extras} onChange={setExtras} rows={4} />
      </div>
    </Modal>
  );
}
