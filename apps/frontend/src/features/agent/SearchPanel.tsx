import { useEffect, useMemo, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/apiClient';
import { esc, formatEventDate, statusLabel } from '../../lib/format';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import { ApplicationMessageModal } from '../../components/listings/ApplicationMessageModal';
import { FacebookAdModal } from '../../components/listings/FacebookAdModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { MediaLightbox } from '../../components/common/MediaLightbox';
import type { Listing, ListingMedia } from '@fast-rental/shared';
import {
  MAX_IMAGES_PER_LISTING,
  MAX_VIDEOS_PER_LISTING,
  MAX_VIDEO_DURATION_DISPLAY_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
} from '@fast-rental/shared';
import { readVideoDurationSeconds } from '../../lib/media';
import { buildListingReferralUrl, copyTextToClipboard } from '../../lib/referral';

type ListingsResponse = {
  items: Listing[];
  summary: { total: number; available: number; onHold: number; averagePrice: number | null };
};

export function SearchPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [quartier, setQuartier] = useState(searchParams.get('quartier') ?? '');
  const [statut, setStatut] = useState(searchParams.get('statut') ?? '');
  const [taille, setTaille] = useState(searchParams.get('taille') ?? '');
  const [source, setSource] = useState(searchParams.get('source') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [openId, setOpenId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ listing: Listing; prefix: 'En application' | 'Request of approval' } | null>(null);
  const [fbModal, setFbModal] = useState<Listing | null>(null);
  const toast = useToast();
  const { profile, isAdmin } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQ) next.set('q', debouncedQ);
    if (quartier) next.set('quartier', quartier);
    if (statut) next.set('statut', statut);
    if (taille) next.set('taille', taille);
    if (source) next.set('source', source);
    setSearchParams(next, { replace: true });
  }, [debouncedQ, quartier, statut, taille, source, setSearchParams]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: '1', pageSize: '100' });
    if (debouncedQ) p.set('q', debouncedQ);
    if (quartier) p.set('quartier', quartier);
    if (statut) p.set('statut', statut);
    if (taille) p.set('taille', taille);
    if (source) p.set('source', source);
    return p.toString();
  }, [debouncedQ, quartier, statut, taille, source]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['listings', params],
    queryFn: () => api.get<ListingsResponse>(`/api/listings?${params}`),
  });

  const areas = useMemo(
    () => [...new Set((data?.items ?? []).map((d) => d.quartier).filter(Boolean))].sort() as string[],
    [data?.items],
  );

  if (isLoading) return <div className="panel-scroll empty">Chargement des logements...</div>;
  if (error) return <div className="panel-scroll empty"><div>Erreur de connexion</div><button className="btn-add" onClick={() => void refetch()}>Réessayer</button></div>;

  return (
    <div className="panel-scroll">
      <div className="search-toolbar">
        <div className="search-toolbar__search">
          <label className="search-filter-label" htmlFor="search-q">Recherche</label>
          <input
            id="search-q"
            className="search-input search-input--toolbar"
            placeholder="Adresse, quartier..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher un logement"
          />
        </div>
        <div className="search-filters">
          <div className="search-filter-field">
            <label className="search-filter-label" htmlFor="filter-quartier">Quartier</label>
            <select id="filter-quartier" className="search-filter-select" value={quartier} onChange={(e) => setQuartier(e.target.value)}>
              <option value="">Tous</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="search-filter-field">
            <label className="search-filter-label" htmlFor="filter-statut">Statut</label>
            <select id="filter-statut" className="search-filter-select" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="">Tous</option>
              <option value="Available">Disponible</option>
              <option value="On Hold">En attente</option>
              <option value="Not Available">Non dispo</option>
              <option value="In Reno">Rénovation</option>
              <option value="Rented">Loué</option>
            </select>
          </div>
          <div className="search-filter-field">
            <label className="search-filter-label" htmlFor="filter-taille">Taille</label>
            <select id="filter-taille" className="search-filter-select" value={taille} onChange={(e) => setTaille(e.target.value)}>
              <option value="">Toutes</option>
              {['2.5', '3.5', '4.5', '5.5', '6.5'].map((s) => <option key={s} value={s}>{s} p.</option>)}
            </select>
          </div>
          <div className="search-filter-field">
            <label className="search-filter-label" htmlFor="filter-source">Source</label>
            <select id="filter-source" className="search-filter-select" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Toutes</option>
              <option value="Fast Rental">Fast Rental</option>
              <option value="Orcha">Orcha</option>
              <option value="manual">Manuel</option>
            </select>
          </div>
        </div>
      </div>
      <div className="search-stats">
        <Stat num={data?.summary.total ?? 0} label="Total" />
        <Stat num={data?.summary.available ?? 0} label="Dispo" color="var(--green)" />
        <Stat num={data?.summary.onHold ?? 0} label="Attente" color="var(--amber)" />
        <Stat num={data?.summary.averagePrice ? Math.round(data.summary.averagePrice).toLocaleString('fr-CA') + '$' : '-'} label="Moy." />
      </div>
      <div className="search-results">
        {(data?.items ?? []).map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            open={openId === listing.id}
            onToggle={() => setOpenId(openId === listing.id ? null : listing.id)}
            toast={toast}
            profile={profile}
            isAdmin={isAdmin}
            onOpenAction={(prefix) => setActionModal({ listing, prefix })}
            onOpenFb={() => setFbModal(listing)}
          />
        ))}
      </div>

      <ApplicationMessageModal
        open={!!actionModal}
        listing={actionModal?.listing ?? null}
        prefix={actionModal?.prefix ?? 'En application'}
        onClose={() => setActionModal(null)}
        onCopied={() => toast('✅ Message copié !')}
      />
      <FacebookAdModal
        open={!!fbModal}
        listing={fbModal}
        onClose={() => setFbModal(null)}
        onCopied={() => toast('✅ Annonce copiée !')}
      />
    </div>
  );
}

function inventoryBadgeClass(statut: string) {
  if (statut === 'Available') return 'inventory-listing-badge--available';
  if (statut === 'On Hold') return 'inventory-listing-badge--hold';
  if (statut === 'Rented') return 'inventory-listing-badge--rented';
  if (statut === 'In Reno') return 'inventory-listing-badge--reno';
  return 'inventory-listing-badge--unavailable';
}

function formatInventoryPrice(value: number | null | undefined) {
  if (!value) return null;
  return Number(value).toLocaleString('fr-CA');
}

function Stat({ num, label, color }: { num: number | string; label: string; color?: string }) {
  return (
    <div className="admin-stat" style={{ padding: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{num}</div>
      <div style={{ fontSize: 10, color: 'var(--text2)' }}>{label}</div>
    </div>
  );
}

function ListingCard({ listing, open, onToggle, toast, profile, isAdmin, onOpenAction, onOpenFb }: {
  listing: Listing; open: boolean; onToggle: () => void; toast: (m: string) => void;
  profile: { id: string; nom: string; email: string; referral_slug: string } | null; isAdmin: boolean;
  onOpenAction: (prefix: 'En application' | 'Request of approval') => void;
  onOpenFb: () => void;
}) {
  const { refreshProfile } = useAuth();
  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['listing', listing.id],
    queryFn: () => api.get<{ listing: Listing; media: ListingMedia[] }>(`/api/listings/${listing.id}`),
    enabled: open,
  });

  async function copyReferral() {
    try {
      const latest = await refreshProfile();
      const url = buildListingReferralUrl(latest, listing.id);
      if (!url) {
        toast('❌ Impossible de générer le lien — contactez un admin pour définir votre nom d\'utilisateur.');
        return;
      }
      await copyTextToClipboard(url);
      toast("Lien copié. L'admin verra cet agent comme suggestion.");
    } catch {
      toast('❌ Impossible de copier le lien.');
    }
  }

  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<ListingMedia | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [previewMedia, setPreviewMedia] = useState<ListingMedia | null>(null);

  function startDelete(media: ListingMedia) {
    setDeleteTarget(media);
    setDeleteStep(1);
  }

  function cancelDelete() {
    setDeleteTarget(null);
    setDeleteStep(0);
  }

  function finishDelete() {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    cancelDelete();

    queryClient.setQueriesData<{ listing: Listing; media: ListingMedia[] }>(
      { queryKey: ['listing', listing.id] },
      (prev) => (prev ? { ...prev, media: prev.media.filter((m) => m.id !== deleted.id) } : prev),
    );
    queryClient.setQueriesData<Array<{ listingId: string; adresse: string; media: ListingMedia[] }>>(
      { queryKey: ['my-media-grouped'] },
      (prev) =>
        prev
          ?.map((group) =>
            group.listingId === deleted.listing_id
              ? { ...group, media: group.media.filter((m) => m.id !== deleted.id) }
              : group,
          )
          .filter((group) => group.media.length > 0) ?? prev,
    );

    void (async () => {
      try {
        await api.delete(`/api/listings/media/${deleted.id}`);
        toast('Média supprimé');
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Suppression impossible';
        toast(`⚠️ ${message}`);
        void queryClient.invalidateQueries({ queryKey: ['listing', listing.id] });
        void queryClient.invalidateQueries({ queryKey: ['my-media-grouped'] });
      }
    })();
  }

  async function uploadMedia(type: 'image' | 'video', file: File) {
    const current = (detail?.media ?? []).filter((m) => m.upload_completed_at && m.type === type).length;
    const max = type === 'image' ? MAX_IMAGES_PER_LISTING : MAX_VIDEOS_PER_LISTING;
    if (current >= max) {
      toast(`⚠️ Limite atteinte (${max} ${type === 'image' ? 'photos' : 'vidéo'} max par logement)`);
      return false;
    }

    let durationSeconds: number | undefined;
    if (type === 'video') {
      try {
        durationSeconds = await readVideoDurationSeconds(file);
      } catch {
        toast('⚠️ Impossible de lire la durée de la vidéo');
        return false;
      }
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        toast(`⚠️ Vidéo trop longue (max ${MAX_VIDEO_DURATION_DISPLAY_SECONDS} secondes)`);
        return false;
      }
    }

    try {
      const uploadMeta = await api.post<{
        mediaId: string;
        uploadUrl: string;
        uploadMode: 'proxy' | 'signed';
      }>(`/api/listings/${listing.id}/media/upload-url`, {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        type,
        ...(durationSeconds != null ? { durationSeconds } : {}),
      });
      if (uploadMeta.uploadMode === 'proxy') {
        await api.uploadFile(`/api/listings/${listing.id}/media/${uploadMeta.mediaId}/file`, file);
      } else {
        const uploadResponse = await fetch(uploadMeta.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!uploadResponse.ok) {
          throw new ApiError(uploadResponse.status, 'UPLOAD_FAILED', 'Échec de l’envoi du fichier');
        }
        await api.post(`/api/listings/${listing.id}/media/${uploadMeta.mediaId}/complete`);
      }
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Échec de l\'upload';
      toast(`⚠️ ${message}`);
      return false;
    }
  }

  async function moveMedia(index: number, direction: -1 | 1) {
    const media = detail?.media ?? [];
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    [next[index], next[target]] = [next[target], next[index]];
    await api.put<ListingMedia[]>(`/api/listings/${listing.id}/media/order`, {
      mediaIds: next.map((item) => item.id),
    });
    void refetchDetail();
  }

  async function pickMedia(type: 'image' | 'video', files: FileList | null) {
    if (!files?.length) return;
    const max = type === 'image' ? MAX_IMAGES_PER_LISTING : MAX_VIDEOS_PER_LISTING;
    const current = (detail?.media ?? []).filter((m) => m.upload_completed_at && m.type === type).length;
    const remaining = Math.max(0, max - current);
    if (remaining === 0) {
      toast(`⚠️ Limite atteinte (${max} ${type === 'image' ? 'photos' : 'vidéo'} max par logement)`);
      return;
    }
    const batch = Array.from(files).slice(0, remaining);
    if (batch.length < files.length) {
      toast(`⚠️ Seulement ${batch.length} fichier(s) ajouté(s) (limite ${max})`);
    }
    const uploaded = (await Promise.all(batch.map((file) => uploadMedia(type, file))))
      .filter(Boolean)
      .length;
    if (uploaded === 0) return;

    void queryClient.invalidateQueries({ queryKey: ['listings'] });
    await Promise.all([
      refetchDetail(),
      queryClient.invalidateQueries({ queryKey: ['my-media-grouped'] }),
    ]);
    toast(uploaded === 1 ? '✅ Média ajouté' : `✅ ${uploaded} médias ajoutés`);
  }

  const full = detail?.listing ?? listing;
  const thumbnail = detail?.media?.find((m) => m.upload_completed_at && m.type === 'image' && m.viewUrl);
  const approvedMediaCount = listing.approved_media_count ?? 0;
  const approvedImageCount = listing.approved_image_count ?? 0;
  const approvedVideoCount = Math.max(0, approvedMediaCount - approvedImageCount);

  return (
    <article className={`inventory-grid-item${open ? ' is-open' : ''}`}>
      <div
        className={`inventory-listing-card${open ? ' is-open' : ''}`}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="inventory-listing-photo">
          {thumbnail?.viewUrl ? (
            <img src={thumbnail.viewUrl} alt={listing.adresse} loading="lazy" />
          ) : (
            <div className="inventory-photo-placeholder">
              <span className="inventory-photo-placeholder__icon" aria-hidden>
                {approvedVideoCount > 0 && approvedImageCount === 0 ? '🎬' : '🏠'}
              </span>
              <span className="inventory-photo-placeholder__title">
                {approvedMediaCount > 0 ? 'Médias disponibles' : 'Aucun média'}
              </span>
              <span className="inventory-photo-placeholder__sub">
                {approvedMediaCount > 0 ? 'Ouvrir pour voir les médias' : 'Ajoutez des photos ou une vidéo'}
              </span>
            </div>
          )}
          <span className={`inventory-listing-badge ${inventoryBadgeClass(listing.statut)}`}>
            {statusLabel(listing.statut)}
          </span>
          <span className="inventory-listing-source">{esc(listing.source)}</span>
        </div>
        <div className="inventory-listing-body">
          <div className="inventory-listing-area">{esc(listing.quartier ?? listing.ville ?? 'Montréal')}</div>
          <div className="inventory-listing-addr">{esc(listing.adresse)}</div>
          <div className="inventory-listing-meta">
            {listing.taille && (
              <span className="inventory-listing-tag">📐 {esc(listing.taille)} p.</span>
            )}
            {listing.electromenagers && (
              <span className="inventory-listing-tag">🍳 {esc(listing.electromenagers)}</span>
            )}
            {approvedImageCount > 0 ? (
              <span className="inventory-listing-tag">📷 {approvedImageCount}</span>
            ) : null}
            {approvedVideoCount > 0 ? (
              <span className="inventory-listing-tag">🎬 {approvedVideoCount}</span>
            ) : null}
          </div>
          <div className="inventory-listing-price">
            {formatInventoryPrice(listing.prix) ? (
              <>
                {formatInventoryPrice(listing.prix)}$
                <small> /mois</small>
              </>
            ) : (
              <small>Prix à confirmer</small>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="inventory-listing-detail apt-card-detail">
          <button
            type="button"
            className="apt-card-close"
            aria-label="Fermer le logement"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <span aria-hidden>×</span>
          </button>
          {full.taille && <Info label="📐 Taille" value={`${full.taille} p.`} />}
          {full.electromenagers && <Info label="🍳 Électro" value={full.electromenagers} />}
          {full.ville && <Info label="🏙️ Ville" value={full.ville} />}
          {full.date_disponibilite && <Info label="📅 Dispo le" value={full.date_disponibilite} />}
          {full.notes && <Info label="📝 Notes" value={full.notes} />}
          {full.code_entree && <Info label="🔑 Entrée" value={full.code_entree} />}
          {full.concierge_tel && <Info label="📞 Concierge" value={full.concierge_tel} />}
          {full.locataire_nom && <Info label="👤 Locataire" value={full.locataire_nom} />}
          {full.locataire_tel && <Info label="📱 Tél. locataire" value={full.locataire_tel} />}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => onOpenAction('En application')}>📲 En application</button>
            <button type="button" className="btn-secondary" onClick={() => onOpenAction('Request of approval')}>📧 Request of Approval</button>
            <button type="button" className="btn-secondary" onClick={onOpenFb}>📢 Générer annonce Facebook</button>
            <button type="button" className="btn-secondary" onClick={copyReferral}>🔗 Copier mon lien</button>
            {isAdmin && (
              <Link to={`/app/admin/listings/${listing.id}/edit`} className="btn-secondary" style={{ gridColumn: '1 / -1', textAlign: 'center', textDecoration: 'none' }}>
                ✏️ Modifier le logement
              </Link>
            )}
            <label className="btn-secondary" style={{ textAlign: 'center' }}>
              📷 Photos (max {MAX_IMAGES_PER_LISTING})
              <input hidden type="file" accept="image/*" multiple onChange={(e) => { void pickMedia('image', e.target.files); e.target.value = ''; }} />
            </label>
            <label className="btn-secondary" style={{ textAlign: 'center' }}>
              🎬 Vidéo (max {MAX_VIDEOS_PER_LISTING}, {MAX_VIDEO_DURATION_DISPLAY_SECONDS} secondes)
              <input hidden type="file" accept="video/*" onChange={(e) => { void pickMedia('video', e.target.files); e.target.value = ''; }} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
            {(detail?.media ?? []).filter((m) => m.upload_completed_at).map((m, index, media) => {
              const canManage = isAdmin || m.uploaded_by === profile?.id;
              return (
              <MediaTile
                key={m.id}
                media={m}
                index={index}
                total={media.length}
                canManage={canManage}
                onMove={(direction) => void moveMedia(index, direction)}
                onDelete={() => startDelete(m)}
                onPreview={() => {
                  if (m.viewUrl) setPreviewMedia(m);
                  else toast('Aperçu indisponible');
                }}
              />
            );
            })}
          </div>
          <CommentsSection listingId={listing.id} userId={profile?.id} isAdmin={isAdmin} />
        </div>
      )}

      <ConfirmDialog
        open={deleteStep === 1}
        message="Ce média sera supprimé."
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        onConfirm={() => setDeleteStep(2)}
        onCancel={cancelDelete}
      />
      <ConfirmDialog
        open={deleteStep === 2}
        message={`Vous êtes sur le point de supprimer ${deleteTarget?.type === 'video' ? 'cette vidéo' : 'cette photo'}. Êtes-vous sûr ?`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => void finishDelete()}
        onCancel={cancelDelete}
      />
      <MediaLightbox
        open={!!previewMedia}
        url={previewMedia?.viewUrl}
        type={previewMedia?.type === 'video' ? 'video' : 'image'}
        alt={previewMedia?.original_filename}
        onClose={() => setPreviewMedia(null)}
      />
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', gap: 6, marginTop: 8 }}><span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 80 }}>{label}</span><span>{esc(value)}</span></div>;
}

function MediaTile({
  media,
  index,
  total,
  canManage,
  onMove,
  onDelete,
  onPreview,
}: {
  media: ListingMedia;
  index: number;
  total: number;
  canManage: boolean;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  async function download() {
    const { url } = await api.get<{ url: string }>(`/api/listings/media/${media.id}/download-url`);
    window.open(url, '_blank');
  }

  return (
    <div className="media-tile">
      <div className="media-tile__media">
        {media.type === 'image' ? (
          media.viewUrl ? (
            <button type="button" className="media-tile__preview" aria-label="Voir en grand" onClick={onPreview}>
              <img src={media.viewUrl} alt={media.original_filename} />
            </button>
          ) : (
            <div className="empty">Image</div>
          )
        ) : media.viewUrl ? (
          <button type="button" className="media-tile__preview" aria-label="Voir en grand" onClick={onPreview}>
            <video src={media.viewUrl} muted preload="metadata" />
          </button>
        ) : (
          <div className="empty">Vidéo</div>
        )}
        {canManage && (
          <button
            type="button"
            className="media-overlay-btn media-overlay-btn--delete"
            aria-label="Supprimer le média"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} strokeWidth={2.25} />
          </button>
        )}
        <button
          type="button"
          className="media-overlay-btn media-overlay-btn--download"
          aria-label="Télécharger le média"
          onClick={(e) => {
            e.stopPropagation();
            void download();
          }}
        >
          <Download size={14} strokeWidth={2.25} />
        </button>
      </div>
      {canManage && (
        <div className="media-order-controls">
          <button
            type="button"
            className="media-order-btn"
            aria-label="Déplacer vers la gauche"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="media-order-btn"
            aria-label="Déplacer vers la droite"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function commentInitials(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function CommentsSection({ listingId, userId, isAdmin }: { listingId: string; userId?: string; isAdmin: boolean }) {
  const toast = useToast();
  const { data, refetch } = useQuery({
    queryKey: ['comments', listingId],
    queryFn: () => api.get<Array<{ id: string; agent_id: string; agent_nom: string; texte: string; created_at: string }>>(`/api/comments/listings/${listingId}/comments`),
  });
  const [text, setText] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [submitting, setSubmitting] = useState(false);

  function startDeleteComment(commentId: string) {
    setPendingDeleteId(commentId);
    setDeleteStep(1);
  }

  function cancelDeleteComment() {
    setPendingDeleteId(null);
    setDeleteStep(0);
  }

  async function submitComment() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/api/comments/listings/${listingId}/comments`, { texte: text.trim() });
      setText('');
      void refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Envoi impossible';
      toast(`⚠️ ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeComment(commentId: string) {
    try {
      await api.delete(`/api/comments/${commentId}`);
      toast('Commentaire supprimé');
      void refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Suppression impossible';
      toast(`⚠️ ${message}`);
    } finally {
      cancelDeleteComment();
    }
  }

  const comments = data ?? [];

  return (
    <section className="listing-comments">
      <div className="listing-comments__header">
        <h4 className="listing-comments__title">Commentaires</h4>
        <span className="listing-comments__count">{comments.length}</span>
      </div>

      {comments.length === 0 ? (
        <p className="listing-comments__empty">Aucun commentaire pour ce logement.</p>
      ) : (
        <ul className="listing-comments__list">
          {comments.map((c) => {
            const canDelete = isAdmin || (userId && c.agent_id === userId);
            return (
              <li key={c.id} className="listing-comment">
                <div className="listing-comment__avatar" aria-hidden>{commentInitials(c.agent_nom)}</div>
                <div className="listing-comment__body">
                  <div className="listing-comment__meta">
                    <span className="listing-comment__author">{esc(c.agent_nom)}</span>
                    <time className="listing-comment__time" dateTime={c.created_at}>{formatEventDate(c.created_at)}</time>
                  </div>
                  <p className="listing-comment__text">{esc(c.texte)}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    className="listing-comment__delete"
                    aria-label="Supprimer le commentaire"
                    onClick={() => startDeleteComment(c.id)}
                  >
                    <Trash2 size={14} strokeWidth={2.25} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="listing-comments__composer">
        <textarea
          className="listing-comments__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ajouter un commentaire…"
          aria-label="Nouveau commentaire"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submitComment();
          }}
        />
        <button
          type="button"
          className="listing-comments__send"
          disabled={!text.trim() || submitting}
          onClick={() => void submitComment()}
        >
          {submitting ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>

      <ConfirmDialog
        open={deleteStep === 1}
        message="Vous allez effacer ce message, êtes-vous sûr ?"
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => setDeleteStep(2)}
        onCancel={cancelDeleteComment}
      />
      <ConfirmDialog
        open={deleteStep === 2}
        message="Effacer ce message ?"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => pendingDeleteId && void removeComment(pendingDeleteId)}
        onCancel={cancelDeleteComment}
      />
    </section>
  );
}
