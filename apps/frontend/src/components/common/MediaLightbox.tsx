import { useEffect } from 'react';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { safeMediaSrc } from '../../lib/urlSafety';
import { ModalPortal } from './ModalPortal';

type MediaLightboxProps = {
  open: boolean;
  url: string | null | undefined;
  type: 'image' | 'video';
  alt?: string;
  onClose: () => void;
};

export function MediaLightbox({ open, url, type, alt, onClose }: MediaLightboxProps) {
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const safeUrl = safeMediaSrc(url);
  if (!open || !safeUrl) return null;

  return (
    <ModalPortal>
      <div className="media-lightbox-overlay" role="presentation" onClick={onClose}>
        <div
          ref={containerRef}
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={alt ?? 'Aperçu du média'}
          onClick={(e) => e.stopPropagation()}
        >
          {type === 'image' ? (
            <img src={safeUrl} alt={alt ?? 'Aperçu du média'} />
          ) : (
            <video src={safeUrl} controls playsInline />
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
