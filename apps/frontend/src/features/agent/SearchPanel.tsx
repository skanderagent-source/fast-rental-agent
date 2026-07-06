import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { env } from '../../lib/env';
import { esc, formatPrice, statusClass, statusLabel } from '../../lib/format';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import { ApplicationMessageModal } from '../../components/listings/ApplicationMessageModal';
import { FacebookAdModal } from '../../components/listings/FacebookAdModal';
import { Modal } from '../../components/common/Modal';
import type { Listing, ListingMedia } from '@fast-rental/shared';

type ListingsResponse = {
  items: Listing[];
  summary: { total: number; available: number; onHold: number; averagePrice: number | null };
};

type ListingWithCounts = Listing & { pending_media_count?: number };

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
      <input className="search-input" placeholder="Adresse, quartier..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un logement" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <select value={quartier} onChange={(e) => setQuartier(e.target.value)} aria-label="Filtrer par quartier"><option value="">Tous les quartiers</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous statuts</option>
          <option value="Available">Disponible</option>
          <option value="On Hold">En attente</option>
          <option value="Not Available">Non dispo</option>
          <option value="In Reno">Rénovation</option>
          <option value="Rented">Loué</option>
        </select>
        <select value={taille} onChange={(e) => setTaille(e.target.value)} aria-label="Filtrer par taille">
          <option value="">Toutes tailles</option>
          {['2.5', '3.5', '4.5', '5.5', '6.5'].map((s) => <option key={s} value={s}>{s} p.</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filtrer par source">
          <option value="">Toutes sources</option>
          <option value="Fast Rental">Fast Rental</option>
          <option value="Orcha">Orcha</option>
          <option value="manual">Manuel</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
        <Stat num={data?.summary.total ?? 0} label="Total" />
        <Stat num={data?.summary.available ?? 0} label="Dispo" color="var(--green)" />
        <Stat num={data?.summary.onHold ?? 0} label="Attente" color="var(--amber)" />
        <Stat num={data?.summary.averagePrice ? Math.round(data.summary.averagePrice).toLocaleString('fr-CA') + '$' : '-'} label="Moy." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data?.items ?? []).map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing as ListingWithCounts}
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

function Stat({ num, label, color }: { num: number | string; label: string; color?: string }) {
  return (
    <div className="admin-stat" style={{ padding: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{num}</div>
      <div style={{ fontSize: 10, color: 'var(--text2)' }}>{label}</div>
    </div>
  );
}

function ListingCard({ listing, open, onToggle, toast, profile, isAdmin, onOpenAction, onOpenFb }: {
  listing: ListingWithCounts; open: boolean; onToggle: () => void; toast: (m: string) => void;
  profile: { id: string; nom: string } | null; isAdmin: boolean;
  onOpenAction: (prefix: 'En application' | 'Request of approval') => void;
  onOpenFb: () => void;
}) {
  const [rentOpen, setRentOpen] = useState(false);
  const [rentValue, setRentValue] = useState(listing.prix != null ? String(listing.prix) : '');

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['listing', listing.id],
    queryFn: () => api.get<{ listing: Listing; media: ListingMedia[] }>(`/api/listings/${listing.id}`),
    enabled: open,
  });

  function copyReferral() {
    if (!profile) return;
    const url = `${env.VITE_PUBLIC_SITE_URL}/?listing=${listing.id}&ref=${profile.id}`;
    void navigator.clipboard.writeText(url);
    toast("Lien copié. L'admin verra cet agent comme suggestion.");
  }

  async function uploadMedia(type: 'image' | 'video', file: File) {
    const uploadMeta = await api.post<{ mediaId: string; uploadUrl: string }>(`/api/listings/${listing.id}/media/upload-url`, {
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      type,
    });
    await fetch(uploadMeta.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    await api.post(`/api/listings/${listing.id}/media/${uploadMeta.mediaId}/complete`);
    toast('✅ Média envoyé — en attente d\'approbation');
    void refetchDetail();
  }

  async function recordRental() {
    await api.post('/api/rentals', {
      listingId: listing.id,
      monthlyRent: rentValue ? Number(rentValue) : listing.prix,
    });
    toast('✅ Location enregistrée');
    setRentOpen(false);
  }

  const pendingCount = listing.pending_media_count ?? 0;
  const full = detail?.listing ?? listing;

  return (
    <>
      <div className="apt-card">
        <div className="apt-card-header" style={{ padding: 12, cursor: 'pointer' }} onClick={onToggle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{esc(listing.adresse)}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {pendingCount > 0 && <span className="badge badge-a">⏳ {pendingCount} en attente</span>}
              <span className={`badge ${statusClass(listing.statut)}`}>{statusLabel(listing.statut)}</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            📍 {esc(listing.quartier)}
            {listing.taille ? ` · ${esc(listing.taille)} p.` : ''}
            {listing.approved_image_count ? ' 📷' : ''}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{formatPrice(listing.prix)}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{esc(listing.source)}</div>
          </div>
        </div>
        {open && (
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
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
              <button type="button" className="btn-secondary" style={{ gridColumn: '1 / -1' }} onClick={onOpenFb}>📢 Générer annonce Facebook</button>
              <button type="button" className="btn-secondary" style={{ gridColumn: '1 / -1' }} onClick={copyReferral}>🔗 Copier mon lien</button>
              <button type="button" className="btn-secondary" style={{ gridColumn: '1 / -1' }} onClick={() => setRentOpen(true)}>🏠 Enregistrer une location</button>
              {isAdmin && (
                <Link to={`/app/admin/listings/${listing.id}/edit`} className="btn-secondary" style={{ gridColumn: '1 / -1', textAlign: 'center', textDecoration: 'none' }}>
                  ✏️ Modifier le logement
                </Link>
              )}
              <label className="btn-secondary" style={{ textAlign: 'center' }}>
                📷 Importer photos
                <input hidden type="file" accept="image/*" multiple onChange={(e) => Array.from(e.target.files ?? []).forEach((f) => void uploadMedia('image', f))} />
              </label>
              <label className="btn-secondary" style={{ textAlign: 'center' }}>
                🎬 Importer vidéos
                <input hidden type="file" accept="video/*" multiple onChange={(e) => Array.from(e.target.files ?? []).forEach((f) => void uploadMedia('video', f))} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
              {(detail?.media ?? []).map((m) => (
                <MediaTile key={m.id} media={m} />
              ))}
            </div>
            <CommentsSection listingId={listing.id} userId={profile?.id} isAdmin={isAdmin} />
          </div>
        )}
      </div>

      <Modal
        open={rentOpen}
        title="Enregistrer une location"
        onClose={() => setRentOpen(false)}
        footer={<button type="button" className="btn-add" onClick={() => void recordRental()}>Enregistrer</button>}
      >
        <div className="form-field">
          <label htmlFor="rent-value">Loyer mensuel confirmé</label>
          <input id="rent-value" type="number" value={rentValue} onChange={(e) => setRentValue(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', gap: 6, marginTop: 8 }}><span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 80 }}>{label}</span><span>{esc(value)}</span></div>;
}

function MediaTile({ media }: { media: ListingMedia }) {
  async function download() {
    const { url } = await api.get<{ url: string }>(`/api/listings/media/${media.id}/download-url`);
    window.open(url, '_blank');
  }
  return (
    <div className="media-tile">
      {media.type === 'image' ? (
        media.viewUrl ? <img src={media.viewUrl} alt={media.original_filename} /> : <div className="empty">Image</div>
      ) : (
        media.viewUrl ? <video src={media.viewUrl} controls /> : <div className="empty">Vidéo</div>
      )}
      <button type="button" className="media-download" aria-label="Télécharger le média" onClick={() => void download()}>Télécharger</button>
      <div style={{ fontSize: 10, padding: 4, color: media.status === 'pending' ? 'var(--amber)' : 'var(--text2)' }}>{media.status}</div>
    </div>
  );
}

function CommentsSection({ listingId, userId, isAdmin }: { listingId: string; userId?: string; isAdmin: boolean }) {
  const toast = useToast();
  const { data, refetch } = useQuery({
    queryKey: ['comments', listingId],
    queryFn: () => api.get<Array<{ id: string; agent_id: string; agent_nom: string; texte: string; created_at: string }>>(`/api/comments/listings/${listingId}/comments`),
  });
  const [text, setText] = useState('');

  async function removeComment(commentId: string) {
    if (!confirm('Supprimer ce commentaire ?')) return;
    await api.delete(`/api/comments/${commentId}`);
    toast('Commentaire supprimé');
    void refetch();
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>💬 Commentaires</div>
      {(data ?? []).map((c) => {
        const canDelete = isAdmin || (userId && c.agent_id === userId);
        return (
          <div key={c.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>{esc(c.agent_nom)}</div>
              {canDelete && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 10 }}
                  aria-label="Supprimer le commentaire"
                  onClick={() => void removeComment(c.id)}
                >
                  Supprimer
                </button>
              )}
            </div>
            <div>{esc(c.texte)}</div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Commentaire..." aria-label="Nouveau commentaire" style={{ flex: 1, minHeight: 40 }} />
        <button type="button" className="btn-secondary" onClick={async () => {
          if (!text.trim()) return;
          await api.post(`/api/comments/listings/${listingId}/comments`, { texte: text });
          setText('');
          void refetch();
        }}>Envoyer</button>
      </div>
    </div>
  );
}
