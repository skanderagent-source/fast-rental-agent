import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { PasswordInput } from '../../components/common/PasswordInput';
import { SanitizedInput } from '../../components/common/SanitizedField';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useSubmitLock, OfflineError } from '../../lib/useSubmitLock';
import { normalizePhoneForApi } from '../../lib/inputSanitize';
import { consumeInviteLinkIntent, waitForInviteSession } from './authApi';
import { validatePasswordPair } from './validation';
import logoUrl from '../../assets/logo-display.png';

const PASSWORD_HINT = 'Minimum 9 caractères, dont une majuscule et un chiffre.';

export function AcceptInvitePage() {
  const [telephone, setTelephone] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [inviteAuthorized, setInviteAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { locked, run } = useSubmitLock({ requireOnline: true });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const hasSession = await waitForInviteSession();
      if (!mounted) return;
      if (!hasSession) {
        setInviteAuthorized(false);
        return;
      }

      const fromInviteLink = consumeInviteLinkIntent();
      try {
        const me = await api.get<{
          profile: {
            must_change_password: boolean;
            telephone: string | null;
          };
        }>('/api/me', { skipSessionAbort: true });
        if (!mounted) return;
        const authorized = fromInviteLink || me.profile.must_change_password;
        setInviteAuthorized(authorized);
        if (authorized && me.profile.telephone) {
          setTelephone(normalizePhoneForApi(me.profile.telephone));
        }
      } catch {
        if (mounted) setInviteAuthorized(fromInviteLink);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function validateProfileFields(): string | null {
    const phone = normalizePhoneForApi(telephone);
    if (phone.length < 6 || phone.length > 15) {
      return 'Numéro de téléphone invalide';
    }
    return validatePasswordPair(pw1, pw2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteAuthorized) return setError('Lien d’invitation invalide ou expiré');
    const validationError = validateProfileFields();
    if (validationError) return setError(validationError);
    const phone = normalizePhoneForApi(telephone);
    try {
      await run(async () => {
        const { error: updateError } = await supabase.auth.updateUser({ password: pw1 });
        if (updateError) return setError('Impossible de définir le mot de passe');
        await supabase.auth.refreshSession();
        await supabase.auth.signOut({ scope: 'others' });
        try {
          await api.patch('/api/me', { telephone: phone });
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Impossible d’enregistrer le profil';
          return setError(message);
        }
        await api.post('/api/me/password-updated');
        await refreshProfile();
        navigate('/app/search', { replace: true });
      });
    } catch (err) {
      if (err instanceof OfflineError) setError(err.message);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--left" aria-hidden />
      <div className="login-page__glow login-page__glow--right" aria-hidden />

      <div className="login-card">
        <header className="login-card__header">
          <div className="login-card__logo-wrap">
            <img src={logoUrl} alt="LogiGo" className="login-card__logo" />
          </div>
          <h1 className="login-card__title">Activer ton compte</h1>
          <p className="login-card__subtitle">Complète ton profil pour finaliser ton invitation</p>
        </header>

        {inviteAuthorized === null && (
          <LoadingSpinner label="Validation de l’invitation…" />
        )}

        {error && (
          <div className="login-alert login-alert--error" role="alert">
            {error}
          </div>
        )}
        {inviteAuthorized === false && (
          <div className="login-alert login-alert--error" role="alert">
            Lien d’invitation invalide ou expiré. Demande une nouvelle invitation à un administrateur.
          </div>
        )}

        {inviteAuthorized === true && (
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="invite-phone">Téléphone</label>
              <SanitizedInput
                id="invite-phone"
                kind="phone"
                maxLength={15}
                value={telephone}
                onChange={setTelephone}
                placeholder="5145550100"
                disabled={locked}
              />
            </div>

            <p className="login-hint">{PASSWORD_HINT}</p>

            <div className="login-field">
              <label htmlFor="invite-password">Mot de passe</label>
              <PasswordInput
                id="invite-password"
                value={pw1}
                onChange={setPw1}
                autoComplete="new-password"
                placeholder="Mot de passe"
                disabled={locked}
              />
            </div>

            <div className="login-field">
              <label htmlFor="invite-password-confirm">Confirmer le mot de passe</label>
              <PasswordInput
                id="invite-password-confirm"
                value={pw2}
                onChange={setPw2}
                autoComplete="new-password"
                placeholder="Confirmer le mot de passe"
                disabled={locked}
              />
            </div>

            <button className="login-submit" type="submit" disabled={locked}>
              {locked ? 'Activation…' : 'Activer mon compte'}
            </button>
          </form>
        )}

        {inviteAuthorized === false && (
          <Link className="login-back" to="/agent-login">
            Retour à la connexion
          </Link>
        )}
      </div>

      <p className="login-footer">Réservé aux agents invités</p>
    </div>
  );
}
