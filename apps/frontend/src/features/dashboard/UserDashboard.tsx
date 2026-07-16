import { useMemo, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { api, ApiError, sensitiveApi } from '../../lib/apiClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { MediaLightbox } from '../../components/common/MediaLightbox';
import { buildInventoryReferralUrl, copyTextToClipboard } from '../../lib/referral';
import { sanitizeFilenameForDisplay } from '../../lib/mediaUpload';
import { formatZodIssues, parseEmailChange, parsePhoneUpdate } from '../../lib/formValidation';
import { useSubmitLock, OfflineError } from '../../lib/useSubmitLock';
import { openUrlSafely, safeMediaSrc } from '../../lib/urlSafety';
import { PasswordInput } from '../../components/common/PasswordInput';
import { SanitizedInput } from '../../components/common/SanitizedField';
import type { ListingMedia } from '@fast-rental/shared';
import { validatePasswordPair } from '../auth/validation';

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
    emailPassword: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  },
) {
  const fields =
    section === 'phone'
      ? [values.currentPhone, values.newPhone, values.confirmNewPhone]
      : section === 'email'
        ? [values.currentEmail, values.newEmail, values.confirmNewEmail, values.emailPassword]
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
  const [openSection, setOpenSection] = useState<ProfileSection | null>(null);
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState | null>(null);
  const [currentPhone, setCurrentPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [confirmNewPhone, setConfirmNewPhone] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setNewEmailConfirm] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const { locked: profileSubmitting, run: runProfileSubmit } = useSubmitLock({ requireOnline: true });

  const formValues = {
    currentPhone,
    newPhone,
    confirmNewPhone,
    currentEmail,
    newEmail,
    confirmNewEmail,
    emailPassword,
    currentPassword,
    newPassword,
    confirmNewPassword,
  };

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
    setEmailPassword('');
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

  async function submitPhoneChange() {
    if (!profile) return;
    try {
      await runProfileSubmit(async () => {
      const next = newPhone.trim();
      const confirm = confirmNewPhone.trim();
      const phoneParsed = parsePhoneUpdate(next);
      if (!phoneParsed.success) {
        toast(`❌ ${formatZodIssues(phoneParsed.error.issues)}`);
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
      });
    } catch (err) {
      if (err instanceof OfflineError) toast(`⚠️ ${err.message}`);
    }
  }

  async function submitEmailChange() {
    if (!profile) return;
    try {
      await runProfileSubmit(async () => {
      if (currentEmail.trim().toLowerCase() !== profile.email.toLowerCase()) {
        toast('❌ L\'email actuel ne correspond pas');
        return;
      }
      const emailParsed = parseEmailChange(newEmail);
      if (!emailParsed.success) {
        toast('❌ Email invalide');
        return;
      }
      if (newEmail !== confirmNewEmail) {
        toast('❌ Les nouveaux emails ne correspondent pas');
        return;
      }
      if (!emailPassword) {
        toast('❌ Confirme ton mot de passe');
        return;
      }
      const { error } = await supabase.auth.updateUser({
        email: emailParsed.data,
        current_password: emailPassword,
      });
      if (error) toast('❌ Impossible de mettre à jour l\'email');
      else {
        await supabase.auth.refreshSession();
        toast('✅ Vérifie ta boîte mail pour confirmer');
        closeSection('email');
      }
      });
    } catch (err) {
      if (err instanceof OfflineError) toast(`⚠️ ${err.message}`);
    }
  }

  async function submitPasswordChange() {
    if (!profile) return;
    try {
      await runProfileSubmit(async () => {
      const validationError = validatePasswordPair(newPassword, confirmNewPassword);
      if (validationError) {
        toast(`❌ ${validationError}`);
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) toast('❌ Impossible de mettre à jour le mot de passe');
      else {
        await supabase.auth.refreshSession();
        await supabase.auth.signOut({ scope: 'others' });
        toast('✅ Mot de passe mis à jour');
        closeSection('password');
      }
      });
    } catch (err) {
      if (err instanceof OfflineError) toast(`⚠️ ${err.message}`);
    }
  }

  async function copyAgentLink() {
    try {
      const latest = await refreshProfile();
      const url = buildInventoryReferralUrl(latest);
      if (!url) {
        toast('❌ Impossible de générer votre lien — contactez un admin pour définir votre nom d\'utilisateur.');
        return;
      }
      await copyTextToClipboard(url);
      toast('Lien copié. Partagez-le — vos clients seront reliés à vous.');
    } catch {
      toast('❌ Impossible de copier le lien.');
    }
  }

  if (!profile) return <div className="panel-scroll empty">Chargement…</div>;

  return (
    <div className="panel-scroll profile-page">
      <section className="profile-hero">
        <div className="profile-hero__avatar" aria-hidden>{initials(profile.nom)}</div>
        <div className="profile-hero__body">
          <div className="profile-hero__header">
            <div className="profile-hero__top">
              <h2 className="profile-hero__name">{profile.nom}</h2>
              <span className={`badge ${profile.role === 'admin' ? 'badge-admin' : 'badge-agent'}`}>
                {profile.role === 'admin' ? 'Admin' : 'Agent'}
              </span>
            </div>
            <button type="button" className="profile-btn profile-btn--ghost profile-hero__link-btn" onClick={() => void copyAgentLink()}>
              Mon Lien
            </button>
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
            <span className="profile-btn__icon profile-btn__icon--email" aria-hidden>✉️</span>
            Email
          </button>
          <button
            type="button"
            className={`profile-btn profile-btn--ghost${openSection === 'password' ? ' profile-btn--active' : ''}`}
            onClick={() => handleSectionTabClick('password')}
          >
            <span className="profile-btn__icon profile-btn__icon--lock" aria-hidden>🔒</span>
            Mot de passe
          </button>
        </div>
        {openSection === 'phone' && (
          <div className="profile-expand">
            <div className="form-field">
              <label htmlFor="current-phone">Numéro actuel</label>
              <SanitizedInput
                id="current-phone"
                kind="phone"
                maxLength={30}
                value={currentPhone}
                onChange={setCurrentPhone}
                placeholder={profile.telephone ? undefined : 'Aucun numéro enregistré'}
                autoComplete="tel"
                disabled={profileSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-phone">{profile.telephone ? 'Nouveau numéro' : 'Numéro'}</label>
              <SanitizedInput
                id="new-phone"
                kind="phone"
                maxLength={30}
                value={newPhone}
                onChange={setNewPhone}
                autoComplete="off"
                disabled={profileSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-phone">Confirmer le {profile.telephone ? 'nouveau ' : ''}numéro</label>
              <SanitizedInput
                id="confirm-phone"
                kind="phone"
                maxLength={30}
                value={confirmNewPhone}
                onChange={setConfirmNewPhone}
                autoComplete="off"
                disabled={profileSubmitting}
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
              <SanitizedInput
                id="current-email"
                kind="email"
                maxLength={320}
                value={currentEmail}
                onChange={setCurrentEmail}
                autoComplete="email"
                disabled={profileSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-email">Nouvel email</label>
              <SanitizedInput
                id="new-email"
                kind="email"
                maxLength={320}
                value={newEmail}
                onChange={setNewEmail}
                autoComplete="off"
                disabled={profileSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-email">Confirmer le nouvel email</label>
              <SanitizedInput
                id="confirm-email"
                kind="email"
                maxLength={320}
                value={confirmNewEmail}
                onChange={setNewEmailConfirm}
                autoComplete="off"
                disabled={profileSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="email-password">Mot de passe actuel</label>
              <PasswordInput
                id="email-password"
                value={emailPassword}
                onChange={setEmailPassword}
                autoComplete="current-password"
                disabled={profileSubmitting}
              />
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
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={profileSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-password">Nouveau mot de passe</label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                disabled={profileSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-password">Confirmer le mot de passe</label>
              <PasswordInput
                id="confirm-password"
                value={confirmNewPassword}
                onChange={setConfirmNewPassword}
                autoComplete="new-password"
                disabled={profileSubmitting}
              />
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
        await sensitiveApi.delete(`/api/listings/media/${deleted.id}`, 'media.delete', deleted.id);
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
    if (safeMediaSrc(media.viewUrl)) setPreviewMedia(media);
    else toast('Aperçu indisponible');
  }

  async function downloadMedia(media: ListingMedia) {
    try {
      const { url } = await api.get<{ url: string }>(`/api/listings/media/${media.id}/download-url`);
      if (!openUrlSafely(url)) toast('⚠️ Lien de téléchargement invalide');
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
                      {media.type === 'image' && safeMediaSrc(media.viewUrl) ? (
                        <img src={safeMediaSrc(media.viewUrl)} alt={sanitizeFilenameForDisplay(media.original_filename)} />
                      ) : media.type === 'video' && safeMediaSrc(media.viewUrl) ? (
                        <video src={safeMediaSrc(media.viewUrl)} muted preload="metadata" />
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
        alt={previewMedia ? sanitizeFilenameForDisplay(previewMedia.original_filename) : undefined}
        onClose={() => setPreviewMedia(null)}
      />
    </section>
  );
}
