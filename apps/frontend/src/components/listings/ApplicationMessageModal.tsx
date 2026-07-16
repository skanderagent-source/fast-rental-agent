import { useState } from 'react';
import { buildActionMessage } from '@fast-rental/shared';
import type { Listing } from '@fast-rental/shared';
import { Modal } from '../common/Modal';
import { SanitizedInput } from '../common/SanitizedField';
import { copyTextToClipboard } from '../../lib/clipboard';
import { formatPrice } from '../../lib/format';

type Props = {
  open: boolean;
  listing: Listing | null;
  prefix: 'En application' | 'Request of approval';
  onClose: () => void;
  onCopied: () => void;
};

export function ApplicationMessageModal({ open, listing, prefix, onClose, onCopied }: Props) {
  const [nom, setNom] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    if (!listing) return;
    if (!nom.trim() || !date.trim()) {
      setError('Nom et date requis');
      return;
    }
    const msg = buildActionMessage(prefix, listing.adresse, formatPrice(listing.prix).replace(' /mois', ''), date, nom);
    try {
      await copyTextToClipboard(msg);
      onCopied();
      onClose();
      setNom('');
      setDate('');
      setError('');
    } catch {
      setError('Impossible de copier le message. Vérifie les permissions du presse-papiers.');
    }
  }

  return (
    <Modal
      open={open}
      title={prefix === 'En application' ? 'Message — En application' : 'Message — Request of Approval'}
      onClose={onClose}
      footer={<button className="btn-add" type="button" onClick={() => void submit()}>Copier le message</button>}
    >
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div className="form-field">
        <label htmlFor="msg-nom">Nom et prénom du prospect</label>
        <SanitizedInput id="msg-nom" kind="personName" maxLength={120} value={nom} onChange={setNom} />
      </div>
      <div className="form-field" style={{ marginTop: 10 }}>
        <label htmlFor="msg-date">Date de déménagement</label>
        <SanitizedInput id="msg-date" kind="dateText" maxLength={20} value={date} onChange={setDate} />
      </div>
    </Modal>
  );
}
