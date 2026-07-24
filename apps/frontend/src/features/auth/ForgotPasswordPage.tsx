import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SanitizedInput } from '../../components/common/SanitizedField';
import { useRateLimitedAction } from '../../lib/useRateLimitedAction';
import { parseLoginEmail } from '../../lib/formValidation';
import { isOnline, OFFLINE_MESSAGE } from '../../lib/onlineStatus';
import { requestPasswordReset } from './authApi';
import logoUrl from '../../assets/logo-display.png';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const linkExpired = searchParams.get('error') === 'otp_expired';
  const passwordResetLimit = useRateLimitedAction('fast-rental:password-reset', 60_000);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess('');
    if (!isOnline()) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    if (!parseLoginEmail(email)) {
      setError('Email invalide');
      return;
    }
    if (passwordResetLimit.blocked) {
      setError(`Réessaie dans ${Math.ceil(passwordResetLimit.remainingMs / 1000)} secondes`);
      return;
    }

    setLoading(true);
    setError('');
    const sent = await passwordResetLimit.run(async () => {
      await requestPasswordReset(
        email.trim(),
        `${window.location.origin}/auth/reset-password`,
      );
    });
    setLoading(false);
    if (!sent) return;

    setSuccess('Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.');
  }

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--left" aria-hidden />
      <div className="login-page__glow login-page__glow--right" aria-hidden />

      <div className="login-card">
        <header className="login-card__header">
          <div className="login-card__logo-wrap">
            <img src={logoUrl} alt="Logigo" className="login-card__logo" />
          </div>
          <h1 className="login-card__title">Mot de passe oublié</h1>
          <p className="login-card__subtitle">Entre ton email pour recevoir un lien de réinitialisation</p>
        </header>

        {linkExpired && !error && !success && (
          <div className="login-alert login-alert--error" role="alert">
            Ce lien de réinitialisation est invalide ou a expiré. Demande un nouveau lien ci-dessous.
          </div>
        )}
        {success && (
          <div className="login-alert login-alert--warning" role="status">
            {success}
          </div>
        )}
        {error && (
          <div className="login-alert login-alert--error" role="alert">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-field">
            <label htmlFor="forgot-email">Email</label>
            <SanitizedInput
              id="forgot-email"
              kind="email"
              maxLength={320}
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="agent@example.com"
              disabled={loading}
            />
          </div>

          <button className="login-submit" type="submit" disabled={loading || passwordResetLimit.blocked}>
            {loading ? (
              <span className="login-submit__loading">
                <span className="login-spinner" aria-hidden />
                Envoi…
              </span>
            ) : (
              'Réinitialiser le mot de passe'
            )}
          </button>

          <Link className="login-back" to="/agent-login">
            Retour à la connexion
          </Link>
        </form>
      </div>

      <p className="login-footer">Réservé aux agents autorisés</p>
    </div>
  );
}
