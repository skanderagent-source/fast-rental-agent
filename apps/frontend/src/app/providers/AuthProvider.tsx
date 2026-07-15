import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { api } from '../../lib/apiClient';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export type Profile = {
  id: string;
  email: string;
  nom: string;
  telephone: string | null;
  role: 'admin' | 'agent';
  actif: boolean;
  must_change_password: boolean;
};

type AuthContextValue = {
  loading: boolean;
  profile: Profile | null;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();

  const refreshProfile = async () => {
    const me = await api.get<{ profile: Profile }>('/api/me');
    setProfile(me.profile);
    if (me.profile.must_change_password) {
      navigate('/auth/force-password-change', { replace: true });
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (mounted) setProfile(null);
          return;
        }
        const me = await api.get<{ profile: Profile }>('/api/me');
        if (!mounted) return;
        setProfile(me.profile);
        if (me.profile.must_change_password) {
          navigate('/auth/force-password-change', { replace: true });
        }
      } catch (err) {
        if (mounted) {
          setProfile(null);
          if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
            await supabase.auth.signOut();
            navigate('/agent-login?expired=1', { replace: true });
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // The explicit load above owns initial hydration. Handling INITIAL_SESSION
      // again would duplicate /api/me and delay first paint in development.
      if (event === 'INITIAL_SESSION') return;
      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Supabase runs this callback while holding its auth lock. Defer API work
      // so apiClient.getSession() cannot contend with that lock.
      setTimeout(() => {
        void refreshProfile().finally(() => setLoading(false));
      }, 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const value = useMemo(
    () => ({
      loading,
      profile,
      isAdmin: profile?.role === 'admin',
      refreshProfile,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        navigate('/agent-login', { replace: true });
      },
    }),
    [loading, profile, navigate],
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingSpinner label="Chargement de la session…" /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
