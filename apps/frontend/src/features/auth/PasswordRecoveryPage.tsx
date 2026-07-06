import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export function PasswordRecoveryPage() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw1.length < 6) return setError('Minimum 6 caractères');
    if (pw1 !== pw2) return setError('Les mots de passe ne correspondent pas');
    const { error: updateError } = await supabase.auth.updateUser({ password: pw1 });
    if (updateError) return setError(updateError.message);
    navigate('/agent-login', { replace: true });
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }}>Réinitialiser le mot de passe</h1>
        {error && <div style={{ color: 'var(--red)', margin: '12px 0' }}>{error}</div>}
        <input type="password" placeholder="Nouveau mot de passe" value={pw1} onChange={(e) => setPw1(e.target.value)} />
        <input type="password" placeholder="Confirmer" value={pw2} onChange={(e) => setPw2(e.target.value)} style={{ marginTop: 12 }} />
        <button className="btn-add" type="submit" style={{ marginTop: 12 }}>Enregistrer</button>
      </form>
    </div>
  );
}
