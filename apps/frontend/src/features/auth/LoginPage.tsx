import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/apiClient';
import { setCachedAccessToken, supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { PasswordInput } from '../../components/common/PasswordInput';
import { SanitizedInput } from '../../components/common/SanitizedField';
import { validateLogin } from './validation';
import { isOnline, OFFLINE_MESSAGE } from '../../lib/onlineStatus';
import logoUrl from '../../assets/logo-display.png';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === '1';
  const { refreshProfile } = useAuth();

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
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
      return;
    }
    setCachedAccessToken(authData.session?.access_token ?? null);
    try {
      const profile = await refreshProfile();
      if (profile.must_change_password) {
        navigate('/auth/force-password-change', { replace: true });
        return;
      }
      await api.post('/api/me/activity/login', undefined, { skipSessionAbort: true });
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

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--left" aria-hidden />
      <div className="login-page__glow login-page__glow--right" aria-hidden />

      <div className="login-card">
        <header className="login-card__header">
          <div className="login-card__logo-wrap">
            <img src={logoUrl} alt="Logigo" className="login-card__logo" />
          </div>
          <h1 className="login-card__title">Logigo</h1>
          <p className="login-card__subtitle">Portail agents</p>
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

          <Link className="login-forgot" to="/auth/forgot-password">
            Mot de passe oublié ?
          </Link>
        </form>
      </div>

      <p className="login-footer">Réservé aux agents autorisés</p>
    </div>
  );
}
