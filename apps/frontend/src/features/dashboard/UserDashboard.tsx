import { useEffect, useMemo, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { MediaLightbox } from '../../components/common/MediaLightbox';
import type { ListingMedia } from '@fast-rental/shared';

type MediaListingGroup = {
  listingId: string;
  adresse: string;
  media: ListingMedia[];
};

function initials(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

type ProfileSection = 'phone' | 'email' | 'password';

type CancelDialogState = {
  section: ProfileSection;
  nextSection: ProfileSection | null;
};

function sectionHasInput(
  section: ProfileSection,
  values: {
    currentPhone: string;
    newPhone: string;
    confirmNewPhone: string;
    currentEmail: string;
    newEmail: string;
    confirmNewEmail: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  },
) {
  const fields =
    section === 'phone'
      ? [values.currentPhone, values.newPhone, values.confirmNewPhone]
      : section === 'email'
        ? [values.currentEmail, values.newEmail, values.confirmNewEmail]
        : [values.currentPassword, values.newPassword, values.confirmNewPassword];
  return fields.some((value) => value.trim().length > 0);
}

function ProfileSectionActions({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="profile-expand__actions">
      <button type="button" className="profile-btn profile-btn--white" onClick={onCancel}>
        Annuler
      </button>
      <button type="button" className="profile-btn profile-btn--primary" onClick={onConfirm}>
        Confirmer
      </button>
    </div>
  );
}

export function UserDashboard() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [nom, setNom] = useState(profile?.nom ?? '');
  const [openSection, setOpenSection] = useState<ProfileSection | null>(null);
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState | null>(null);
  const [currentPhone, setCurrentPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [confirmNewPhone, setConfirmNewPhone] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setNewEmailConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const formValues = {
    currentPhone,
    newPhone,
    confirmNewPhone,
    currentEmail,
    newEmail,
    confirmNewEmail,
    currentPassword,
    newPassword,
    confirmNewPassword,
  };

  useEffect(() => {
    if (profile?.nom) setNom(profile.nom);
  }, [profile?.nom]);

  const { data: myRentals } = useQuery({
    queryKey: ['my-rentals'],
    queryFn: () => api.get<Array<{ id: string; monthly_rent: number | null; rented_at: string; logements?: { adresse: string; quartier: string } }>>('/api/rentals/me'),
  });

  const { data: mediaGroups, isLoading: mediaLoading, isError: mediaError } = useQuery({
    queryKey: ['my-media-grouped', profile?.id],
    queryFn: () => api.get<MediaListingGroup[]>('/api/listings/me/media'),
    enabled: !!profile,
    staleTime: 30_000,
  });

  const stats = useMemo(() => ({
    rentals: myRentals?.length ?? 0,
    media: mediaGroups?.reduce((n, g) => n + g.media.length, 0) ?? 0,
  }), [myRentals?.length, mediaGroups]);

  function clearPhoneForm() {
    setCurrentPhone('');
    setNewPhone('');
    setConfirmNewPhone('');
  }

  function clearEmailForm() {
    setCurrentEmail('');
    setNewEmail('');
    setNewEmailConfirm('');
  }

  function clearPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  }

  function clearSectionForm(section: ProfileSection) {
    if (section === 'phone') clearPhoneForm();
    if (section === 'email') clearEmailForm();
    if (section === 'password') clearPasswordForm();
  }

  function closeSection(section: ProfileSection, nextSection: ProfileSection | null = null) {
    clearSectionForm(section);
    setOpenSection(nextSection);
  }

  function requestCloseSection(section: ProfileSection, nextSection: ProfileSection | null = null) {
    if (!sectionHasInput(section, formValues)) {
      closeSection(section, nextSection);
      return;
    }
    setCancelDialog({ section, nextSection });
  }

  function handleSectionTabClick(section: ProfileSection) {
    if (openSection === section) {
      requestCloseSection(section);
      return;
    }
    if (openSection && sectionHasInput(openSection, formValues)) {
      setCancelDialog({ section: openSection, nextSection: section });
      return;
    }
    if (openSection) clearSectionForm(openSection);
    setOpenSection(section);
  }

  function handleDiscardChanges() {
    if (!cancelDialog) return;
    closeSection(cancelDialog.section, cancelDialog.nextSection);
    setCancelDialog(null);
  }

  async function saveProfile() {
    await api.patch('/api/me', { nom });
    await refreshProfile();
    toast('✅ Profil mis à jour');
  }

  async function submitPhoneChange() {
    if (!profile) return;
    const next = newPhone.trim();
    const confirm = confirmNewPhone.trim();
    if (next.length < 6) {
      toast('❌ Numéro trop court (min. 6 caractères)');
      return;
    }
    if (next !== confirm) {
      toast('❌ Les numéros ne correspondent pas');
      return;
    }
    const existing = profile.telephone?.trim() ?? '';
    if (existing) {
      if (currentPhone.trim() !== existing) {
        toast('❌ Le numéro actuel ne correspond pas');
        return;
      }
    } else if (currentPhone.trim()) {
      toast('❌ Laisse le champ numéro actuel vide');
      return;
    }
    await api.patch('/api/me', { telephone: next });
    await refreshProfile();
    toast('✅ Téléphone mis à jour');
    closeSection('phone');
  }

  async function submitEmailChange() {
    if (!profile) return;
    if (currentEmail.trim().toLowerCase() !== profile.email.toLowerCase()) {
      toast('❌ L\'email actuel ne correspond pas');
      return;
    }
    if (newEmail !== confirmNewEmail) {
      toast('❌ Les nouveaux emails ne correspondent pas');
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) toast('❌ ' + error.message);
    else {
      toast('✅ Vérifie ta boîte mail pour confirmer');
      closeSection('email');
    }
  }

  async function submitPasswordChange() {
    if (!profile) return;
    if (newPassword.length < 6) {
      toast('❌ Mot de passe min. 6 caractères');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast('❌ Les mots de passe ne correspondent pas');
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });
    if (signInError) {
      toast('❌ Mot de passe actuel incorrect');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast('❌ ' + error.message);
    else {
      toast('✅ Mot de passe mis à jour');
      closeSection('password');
    }
  }

  if (!profile) return <div className="panel-scroll empty">Chargement…</div>;

  return (
    <div className="panel-scroll profile-page">
      <section className="profile-hero">
        <div className="profile-hero__avatar" aria-hidden>{initials(nom || profile.nom)}</div>
        <div className="profile-hero__body">
          <div className="profile-hero__top">
            <h2 className="profile-hero__name">{profile.nom}</h2>
            <span className={`badge ${profile.role === 'admin' ? 'badge-admin' : 'badge-agent'}`}>
              {profile.role === 'admin' ? 'Admin' : 'Agent'}
            </span>
          </div>
          <p className="profile-hero__email">{profile.email}</p>
          {profile.telephone && <p className="profile-hero__phone">{profile.telephone}</p>}
          <div className="profile-stats">
            <div className="profile-stat"><span>{stats.rentals}</span> locations</div>
            <div className="profile-stat"><span>{stats.media}</span> médias</div>
          </div>
        </div>
      </section>

      <section className="profile-card">
        <h3 className="profile-card__title">Informations</h3>
        <div className="profile-name-row">
          <div className="form-field profile-name-row__field">
            <label htmlFor="profile-nom">Nom affiché</label>
            <input id="profile-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <button type="button" className="profile-btn profile-btn--primary" onClick={() => void saveProfile()}>
            Enregistrer
          </button>
        </div>
        <div className="profile-actions">
          <button
            type="button"
            className={`profile-btn profile-btn--ghost${openSection === 'phone' ? ' profile-btn--active' : ''}`}
            onClick={() => handleSectionTabClick('phone')}
          >
            📞 Téléphone
          </button>
          <button
            type="button"
            className={`profile-btn profile-btn--ghost${openSection === 'email' ? ' profile-btn--active' : ''}`}
            onClick={() => handleSectionTabClick('email')}
          >
            ✉️ Email
          </button>
          <button
            type="button"
            className={`profile-btn profile-btn--ghost${openSection === 'password' ? ' profile-btn--active' : ''}`}
            onClick={() => handleSectionTabClick('password')}
          >
            🔒 Mot de passe
          </button>
        </div>
        {openSection === 'phone' && (
          <div className="profile-expand">
            <div className="form-field">
              <label htmlFor="current-phone">Numéro actuel</label>
              <input
                id="current-phone"
                type="tel"
                value={currentPhone}
                onChange={(e) => setCurrentPhone(e.target.value)}
                placeholder={profile.telephone ? undefined : 'Aucun numéro enregistré'}
                autoComplete="tel"
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-phone">{profile.telephone ? 'Nouveau numéro' : 'Numéro'}</label>
              <input
                id="new-phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-phone">Confirmer le {profile.telephone ? 'nouveau ' : ''}numéro</label>
              <input
                id="confirm-phone"
                type="tel"
                value={confirmNewPhone}
                onChange={(e) => setConfirmNewPhone(e.target.value)}
                autoComplete="off"
              />
            </div>
            <ProfileSectionActions
              onCancel={() => requestCloseSection('phone')}
              onConfirm={() => void submitPhoneChange()}
            />
          </div>
        )}
        {openSection === 'email' && (
          <div className="profile-expand">
            <div className="form-field">
              <label htmlFor="current-email">Email actuel</label>
              <input id="current-email" type="email" value={currentEmail} onChange={(e) => setCurrentEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="form-field">
              <label htmlFor="new-email">Nouvel email</label>
              <input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-email">Confirmer le nouvel email</label>
              <input id="confirm-email" type="email" value={confirmNewEmail} onChange={(e) => setNewEmailConfirm(e.target.value)} autoComplete="off" />
            </div>
            <ProfileSectionActions
              onCancel={() => requestCloseSection('email')}
              onConfirm={() => void submitEmailChange()}
            />
          </div>
        )}
        {openSection === 'password' && (
          <div className="profile-expand">
            <div className="form-field">
              <label htmlFor="current-password">Mot de passe actuel</label>
              <input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="form-field">
              <label htmlFor="new-password">Nouveau mot de passe</label>
              <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-password">Confirmer le mot de passe</label>
              <input id="confirm-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <ProfileSectionActions
              onCancel={() => requestCloseSection('password')}
              onConfirm={() => void submitPasswordChange()}
            />
          </div>
        )}
        <ConfirmDialog
          open={cancelDialog !== null}
          message="Vous êtes sur le point d'annuler vos modifications."
          cancelLabel="Continuer les modifications"
          confirmLabel="Annuler les modifications"
          confirmTone="primary"
          onCancel={() => setCancelDialog(null)}
          onConfirm={handleDiscardChanges}
        />
      </section>

      <section className="profile-card">
        <h3 className="profile-card__title">Mes locations</h3>
        {(myRentals ?? []).length === 0 && <p className="profile-empty">Aucune location enregistrée.</p>}
        <div className="profile-list">
          {(myRentals ?? []).map((r) => (
            <article key={r.id} className="profile-list-item profile-list-item--static">
              <div className="profile-list-item__title">{r.logements?.adresse ?? 'Logement'}</div>
              <div className="profile-list-item__meta">
                {r.logements?.quartier}
                {r.monthly_rent != null && ` · ${r.monthly_rent}$/mois`}
                {` · ${new Date(r.rented_at).toLocaleDateString('fr-CA')}`}
              </div>
            </article>
          ))}
        </div>
      </section>

      <MyMediaSection
        groups={mediaGroups ?? []}
        loading={mediaLoading}
        error={mediaError}
        toast={toast}
      />
    </div>
  );
}

function MyMediaSection({
  groups,
  loading,
  error,
  toast,
}: {
  groups: MediaListingGroup[];
  loading: boolean;
  error: boolean;
  toast: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const [openListingId, setOpenListingId] = useState<string | null>(null);
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

    queryClient.setQueriesData<MediaListingGroup[]>(
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
    queryClient.setQueriesData<{ media: ListingMedia[] }>(
      { queryKey: ['listing', deleted.listing_id] },
      (prev) => (prev ? { ...prev, media: prev.media.filter((m) => m.id !== deleted.id) } : prev),
    );

    void (async () => {
      try {
        await api.delete(`/api/listings/media/${deleted.id}`);
        toast('Média supprimé');
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Suppression impossible';
        toast(`⚠️ ${message}`);
        void queryClient.invalidateQueries({ queryKey: ['my-media-grouped'] });
        void queryClient.invalidateQueries({ queryKey: ['listing', deleted.listing_id] });
      }
    })();
  }

  function openPreview(media: ListingMedia) {
    if (media.viewUrl) setPreviewMedia(media);
    else toast('Aperçu indisponible');
  }

  async function downloadMedia(media: ListingMedia) {
    try {
      const { url } = await api.get<{ url: string }>(`/api/listings/media/${media.id}/download-url`);
      window.open(url, '_blank');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Téléchargement impossible';
      toast(`⚠️ ${message}`);
    }
  }

  return (
    <section className="profile-card">
      <h3 className="profile-card__title">Mes médias</h3>
      {loading && <p className="profile-empty">Chargement des médias…</p>}
      {error && <p className="profile-empty">Impossible de charger les médias.</p>}
      {!loading && !error && groups.length === 0 && <p className="profile-empty">Aucun média uploadé.</p>}
      <div className="profile-list">
        {groups.map((group) => (
          <article key={group.listingId} className="my-media-listing">
            <button
              type="button"
              className={`my-media-listing__header${openListingId === group.listingId ? ' my-media-listing__header--open' : ''}`}
              onClick={() => setOpenListingId(openListingId === group.listingId ? null : group.listingId)}
            >
              <span className="my-media-listing__title">{group.adresse}</span>
              <span className="my-media-listing__count">{group.media.length} média{group.media.length > 1 ? 's' : ''}</span>
            </button>
            {openListingId === group.listingId && (
              <div className="my-media-grid">
                {group.media.map((media) => (
                  <div key={media.id} className="my-media-thumb">
                    <button
                      type="button"
                      className="my-media-thumb__preview"
                      aria-label="Voir en grand"
                      onClick={() => openPreview(media)}
                    >
                      {media.type === 'image' && media.viewUrl ? (
                        <img src={media.viewUrl} alt={media.original_filename} />
                      ) : media.type === 'video' && media.viewUrl ? (
                        <video src={media.viewUrl} muted preload="metadata" />
                      ) : (
                        <span className="my-media-thumb__placeholder">{media.type === 'video' ? '🎬' : '📷'}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="media-overlay-btn media-overlay-btn--delete"
                      aria-label="Supprimer"
                      onClick={(e) => {
                        e.stopPropagation();
                        startDelete(media);
                      }}
                    >
                      <Trash2 size={14} strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      className="media-overlay-btn media-overlay-btn--download"
                      aria-label="Télécharger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void downloadMedia(media);
                      }}
                    >
                      <Download size={14} strokeWidth={2.25} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

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
    </section>
  );
}
