import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { PasswordInput } from '../../components/common/PasswordInput';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useSubmitLock, OfflineError } from '../../lib/useSubmitLock';
import { consumeRecoveryLinkIntent, waitForRecoverySession } from './authApi';
import { validatePasswordPair } from './validation';
import logoUrl from '../../assets/logo-display.png';

const PASSWORD_HINT = 'Minimum 9 caractères, dont une majuscule et un chiffre.';

export function PasswordRecoveryPage() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [recoveryAuthorized, setRecoveryAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { locked, run } = useSubmitLock({ requireOnline: true });

  useEffect(() => {
    let mounted = true;
    void waitForRecoverySession().then((authorized) => {
      if (!mounted) return;
      if (authorized) consumeRecoveryLinkIntent();
      setRecoveryAuthorized(authorized);
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryAuthorized) return setError('Lien de récupération invalide ou expiré');
    const validationError = validatePasswordPair(pw1, pw2);
    if (validationError) return setError(validationError);
    try {
      await run(async () => {
        const { error: updateError } = await supabase.auth.updateUser({ password: pw1 });
        if (updateError) return setError('Impossible de mettre à jour le mot de passe');
        await supabase.auth.signOut({ scope: 'global' });
        navigate('/agent-login', { replace: true });
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
          <h1 className="login-card__title">Réinitialiser le mot de passe</h1>
          <p className="login-card__subtitle">Choisis un nouveau mot de passe pour ton compte</p>
        </header>

        {recoveryAuthorized === null && (
          <LoadingSpinner label="Validation du lien…" />
        )}

        {error && (
          <div className="login-alert login-alert--error" role="alert">
            {error}
          </div>
        )}
        {recoveryAuthorized === false && (
          <div className="login-alert login-alert--error" role="alert">
            Lien de récupération invalide ou expiré.
          </div>
        )}

        {recoveryAuthorized === true && (
          <form className="login-form" onSubmit={submit}>
            <p className="login-hint">{PASSWORD_HINT}</p>

            <div className="login-field">
              <label htmlFor="recovery-password">Nouveau mot de passe</label>
              <PasswordInput
                id="recovery-password"
                value={pw1}
                onChange={setPw1}
                autoComplete="new-password"
                placeholder="Nouveau mot de passe"
                disabled={locked}
              />
            </div>

            <div className="login-field">
              <label htmlFor="recovery-password-confirm">Confirmer</label>
              <PasswordInput
                id="recovery-password-confirm"
                value={pw2}
                onChange={setPw2}
                autoComplete="new-password"
                placeholder="Confirmer le mot de passe"
                disabled={locked}
              />
            </div>

            <button className="login-submit" type="submit" disabled={locked}>
              {locked ? 'Enregistrement…' : 'Enregistrer'}
            </button>

            <Link className="login-back" to="/agent-login">
              Retour à la connexion
            </Link>
          </form>
        )}

        {recoveryAuthorized === false && (
          <Link className="login-back" to="/auth/forgot-password">
            Demander un nouveau lien
          </Link>
        )}
      </div>

      <p className="login-footer">Réservé aux agents autorisés</p>
    </div>
  );
}
