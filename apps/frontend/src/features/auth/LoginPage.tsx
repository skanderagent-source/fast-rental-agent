import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../components/common/ToastProvider';
import { requestPasswordReset } from './authApi';
import { validateLogin } from './validation';

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      await refreshProfile();
      await api.post('/api/me/activity/login');
      navigate('/app/search', { replace: true });
    } catch {
      setError('Profil introuvable. Contactez votre administrateur.');
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    if (!email) {
      setError('Entre ton email d\'abord, puis clique « Mot de passe oublié »');
      return;
    }
    const { error: resetError } = await requestPasswordReset(
      email,
      `${window.location.origin}/auth/reset-password`,
    );
    if (resetError) setError('Erreur — vérifie ton email');
    else toast('✅ Email de réinitialisation envoyé !');
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
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="agent@example.com"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Mot de passe</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
          >
            Mot de passe oublié ?
          </button>
        </form>
      </div>

      <p className="login-footer">Réservé aux agents autorisés</p>
    </div>
  );
}
