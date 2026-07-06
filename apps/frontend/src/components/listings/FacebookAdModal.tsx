import { useEffect, useState } from 'react';
import { buildFacebookAd } from '@fast-rental/shared';
import type { Listing } from '@fast-rental/shared';
import { Modal } from '../common/Modal';

type Props = {
  open: boolean;
  listing: Listing | null;
  onClose: () => void;
  onCopied: () => void;
};

export function FacebookAdModal({ open, listing, onClose, onCopied }: Props) {
  const [dispo, setDispo] = useState('');
  const [extras, setExtras] = useState('');

  useEffect(() => {
    if (listing) setExtras(listing.notes ?? '');
  }, [listing]);

  function submit() {
    if (!listing) return;
    const msg = buildFacebookAd(listing, dispo, extras);
    void navigator.clipboard.writeText(msg);
    onCopied();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Générer annonce Facebook"
      onClose={onClose}
      footer={<button className="btn-add" type="button" onClick={submit}>Copier l'annonce</button>}
    >
      <div className="form-field">
        <label htmlFor="fb-dispo">Date de disponibilité</label>
        <input id="fb-dispo" value={dispo} onChange={(e) => setDispo(e.target.value)} />
      </div>
      <div className="form-field" style={{ marginTop: 10 }}>
        <label htmlFor="fb-extras">Extras (optionnel)</label>
        <textarea id="fb-extras" value={extras} onChange={(e) => setExtras(e.target.value)} rows={4} />
      </div>
    </Modal>
  );
}
