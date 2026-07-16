import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/apiClient';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import { PasswordInput } from '../../components/common/PasswordInput';
import { SanitizedInput } from '../../components/common/SanitizedField';
import { useRateLimitedAction } from '../../lib/useRateLimitedAction';
import { requestPasswordReset } from './authApi';
import { validateLogin } from './validation';
import { isOnline, OFFLINE_MESSAGE } from '../../lib/onlineStatus';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === '1';
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const passwordResetLimit = useRateLimitedAction('fast-rental:password-reset', 60_000);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline()) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    const validationError = validateLogin(email, password);
    if (validationError) {
      setError(validationError === 'Email requis' ? 'Email et mot de passe requis' : validationError);
      return;
    }
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
      return;
    }
    try {
      const profile = await refreshProfile();
      if (profile.must_change_password) {
        navigate('/auth/force-password-change', { replace: true });
        return;
      }
      await api.post('/api/me/activity/login');
      navigate('/app/search', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REQUEST_ABORTED') {
        setError('Connexion interrompue. Réessaie une fois.');
      } else if (err instanceof ApiError && err.code === 'INVALID_API_RESPONSE') {
        setError('Réponse profil invalide du serveur. Contactez un administrateur.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Profil introuvable. Contactez votre administrateur.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Session refusée par le serveur. Recharge la page et réessaie.');
      } else {
        setError('Impossible de charger ton profil. Vérifie que l\'API tourne et réessaie.');
      }
      if (!(err instanceof ApiError && (err.code === 'REQUEST_ABORTED' || err.code === 'INVALID_API_RESPONSE'))) {
        await supabase.auth.signOut();
      }
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    if (!email) {
      setError('Entre ton email d\'abord, puis clique « Mot de passe oublié »');
      return;
    }
    if (passwordResetLimit.blocked) {
      setError(`Réessaie dans ${Math.ceil(passwordResetLimit.remainingMs / 1000)} secondes`);
      return;
    }
    const sent = await passwordResetLimit.run(async () => {
      await requestPasswordReset(
        email,
        `${window.location.origin}/auth/reset-password`,
      );
    });
    if (!sent) return;
    toast('Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.');
    setError('');
  }

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--left" aria-hidden />
      <div className="login-page__glow login-page__glow--right" aria-hidden />

      <div className="login-card">
        <header className="login-card__header">
          <img src="/logo.png" alt="" className="login-card__logo" width={56} height={56} />
          <h1 className="login-card__title">LogiGo Agent</h1>
          <p className="login-card__subtitle">Portail agents — Fast Rental</p>
        </header>

        {sessionExpired && (
          <div className="login-alert login-alert--warning" role="status">
            Ta session a expiré. Reconnecte-toi pour continuer.
          </div>
        )}
        {error && (
          <div className="login-alert login-alert--error" role="alert">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <SanitizedInput
              id="login-email"
              kind="email"
              maxLength={320}
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="agent@example.com"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Mot de passe</label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="login-submit__loading">
                <span className="login-spinner" aria-hidden />
                Connexion…
              </span>
            ) : (
              'Se connecter'
            )}
          </button>

          <button
            type="button"
            className="login-forgot"
            onClick={() => void forgotPassword()}
            disabled={loading || passwordResetLimit.blocked}
          >
            {passwordResetLimit.blocked
              ? `Réessayer dans ${Math.ceil(passwordResetLimit.remainingMs / 1000)}s`
              : 'Mot de passe oublié ?'}
          </button>
        </form>
      </div>

      <p className="login-footer">Réservé aux agents autorisés</p>
    </div>
  );
}
