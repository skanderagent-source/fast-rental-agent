import { useEffect, useId } from 'react';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { ModalPortal } from './ModalPortal';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const titleId = useId();
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="modal-overlay"
        role="presentation"
        onClick={onClose}
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="modal-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-panel__header">
            <h3 id={titleId} className="modal-panel__title">{title}</h3>
            <button type="button" className="btn-secondary modal-panel__close" aria-label="Fermer" onClick={onClose}>✕</button>
          </div>
          {children}
          {footer && <div className="modal-panel__footer">{footer}</div>}
        </div>
      </div>
    </ModalPortal>
  );
}
