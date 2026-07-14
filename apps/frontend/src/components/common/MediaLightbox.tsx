import { useEffect } from 'react';

type MediaLightboxProps = {
  open: boolean;
  url: string | null | undefined;
  type: 'image' | 'video';
  alt?: string;
  onClose: () => void;
};

export function MediaLightbox({ open, url, type, alt, onClose }: MediaLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !url) return null;

  return (
    <div className="media-lightbox-overlay" role="presentation" onClick={onClose}>
      <div className="media-lightbox" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {type === 'image' ? (
          <img src={url} alt={alt ?? 'Aperçu du média'} />
        ) : (
          <video src={url} controls autoPlay playsInline />
        )}
      </div>
    </div>
  );
}
