import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../app/providers/AuthProvider';
import { PasswordInput } from '../../components/common/PasswordInput';
import { useSubmitLock, OfflineError } from '../../lib/useSubmitLock';
import { validatePasswordPair } from './validation';
import logoUrl from '../../assets/logo-display.png';

const PASSWORD_HINT = 'Minimum 9 caractères, dont une majuscule et un chiffre.';

export function ForcePasswordChangePage() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { locked, run } = useSubmitLock({ requireOnline: true });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validatePasswordPair(pw1, pw2);
    if (validationError) return setError(validationError);
    try {
      await run(async () => {
        const { error: updateError } = await supabase.auth.updateUser({ password: pw1 });
        if (updateError) return setError('Impossible de mettre à jour le mot de passe');
        await supabase.auth.refreshSession();
        await supabase.auth.signOut({ scope: 'others' });
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
          <h1 className="login-card__title">Nouveau mot de passe</h1>
          <p className="login-card__subtitle">Tu dois définir un nouveau mot de passe pour continuer</p>
        </header>

        {error && (
          <div className="login-alert login-alert--error" role="alert">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={submit}>
          <p className="login-hint">{PASSWORD_HINT}</p>

          <div className="login-field">
            <label htmlFor="force-password">Nouveau mot de passe</label>
            <PasswordInput
              id="force-password"
              value={pw1}
              onChange={setPw1}
              autoComplete="new-password"
              placeholder="Nouveau mot de passe"
              disabled={locked}
            />
          </div>

          <div className="login-field">
            <label htmlFor="force-password-confirm">Confirmer</label>
            <PasswordInput
              id="force-password-confirm"
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
        </form>
      </div>

      <p className="login-footer">Réservé aux agents autorisés</p>
    </div>
  );
}
