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
    <div className="login-screen" style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form className="login-box" style={{ width: '100%', maxWidth: 380 }} onSubmit={onSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>LogiGo Agent</div>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Espace agent — Connexion</div>
        </div>
        {sessionExpired && (
          <div style={{ background: 'var(--yellow-bg, #fef3c7)', color: 'var(--text)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            Ta session a expiré. Reconnecte-toi pour continuer.
          </div>
        )}
        {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', margin: '14px 0 6px' }}>Mot de passe</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button className="login-btn" type="submit" disabled={loading} style={{ marginTop: 8 }}>{loading ? 'Connexion...' : 'Se connecter'}</button>
        <button type="button" onClick={() => void forgotPassword()} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, marginTop: 16, cursor: 'pointer', width: '100%' }}>Mot de passe oublié ?</button>
      </form>
    </div>
  );
}
