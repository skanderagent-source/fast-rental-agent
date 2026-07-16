import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { PasswordInput } from '../../components/common/PasswordInput';
import { useSubmitLock, OfflineError } from '../../lib/useSubmitLock';
import { hasRecoveryAuthenticator } from './authApi';
import { validatePasswordPair } from './validation';

export function PasswordRecoveryPage() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [recoveryAuthorized, setRecoveryAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { locked, run } = useSubmitLock({ requireOnline: true });

  useEffect(() => {
    void hasRecoveryAuthenticator().then(setRecoveryAuthorized);
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
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }}>Réinitialiser le mot de passe</h1>
        {error && <div style={{ color: 'var(--red)', margin: '12px 0' }}>{error}</div>}
        {recoveryAuthorized === false && (
          <div style={{ color: 'var(--red)', margin: '12px 0' }}>Lien de récupération invalide ou expiré.</div>
        )}
        <PasswordInput
          value={pw1}
          onChange={setPw1}
          autoComplete="new-password"
          placeholder="Nouveau mot de passe"
          disabled={locked || recoveryAuthorized !== true}
        />
        <div style={{ marginTop: 12 }}>
          <PasswordInput
            value={pw2}
            onChange={setPw2}
            autoComplete="new-password"
            placeholder="Confirmer"
            disabled={locked || recoveryAuthorized !== true}
          />
        </div>
        <button
          className="btn-add"
          type="submit"
          disabled={locked || recoveryAuthorized !== true}
          style={{ marginTop: 12 }}
        >
          {locked ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
