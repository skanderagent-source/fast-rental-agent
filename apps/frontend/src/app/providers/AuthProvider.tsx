import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { api } from '../../lib/apiClient';
import { agentProfileSchema } from '@fast-rental/shared';
import { parseApi } from '../../lib/parseApi';
import { clearClientSession } from '../../lib/authSession';
import { queryClient } from './QueryProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export type Profile = {
  id: string;
  email: string;
  nom: string;
  telephone: string | null;
  role: 'admin' | 'agent';
  actif: boolean;
  must_change_password: boolean;
  referral_slug: string;
};

type AuthContextValue = {
  loading: boolean;
  profile: Profile | null;
  isAdmin: boolean;
  refreshProfile: () => Promise<Profile>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applyProfile(
  next: Profile,
  activeUserIdRef: MutableRefObject<string | null>,
  setProfile: (profile: Profile) => void,
) {
  if (activeUserIdRef.current && activeUserIdRef.current !== next.id) {
    clearClientSession(queryClient);
  }
  activeUserIdRef.current = next.id;
  setProfile(next);
}

function clearAuthState(
  activeUserIdRef: MutableRefObject<string | null>,
  setProfile: (profile: Profile | null) => void,
) {
  activeUserIdRef.current = null;
  setProfile(null);
  clearClientSession(queryClient);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const activeUserIdRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<Profile> | null>(null);

  const refreshProfile = useCallback(async (): Promise<Profile> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const request = (async () => {
      const me = await api.get<{ profile: unknown }>('/api/me', { skipSessionAbort: true });
      const profile = parseApi(agentProfileSchema, me.profile, 'Profil agent');
      applyProfile(profile, activeUserIdRef, setProfile);
      if (profile.must_change_password) {
        navigate('/auth/force-password-change', { replace: true });
      }
      return profile;
    })();

    refreshInFlightRef.current = request;
    try {
      return await request;
    } finally {
      if (refreshInFlightRef.current === request) {
        refreshInFlightRef.current = null;
      }
    }
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (mounted) clearAuthState(activeUserIdRef, setProfile);
          return;
        }
        const me = await api.get<{ profile: unknown }>('/api/me', { skipSessionAbort: true });
        if (!mounted) return;
        const loaded = parseApi(agentProfileSchema, me.profile, 'Profil agent');
        applyProfile(loaded, activeUserIdRef, setProfile);
        if (loaded.must_change_password) {
          navigate('/auth/force-password-change', { replace: true });
        }
      } catch (err) {
        if (mounted) {
          clearAuthState(activeUserIdRef, setProfile);
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
      if (event === 'INITIAL_SESSION') return;
      if (!session) {
        clearAuthState(activeUserIdRef, setProfile);
        setLoading(false);
        return;
      }
      setTimeout(() => {
        void refreshProfile()
          .catch(() => {
            clearAuthState(activeUserIdRef, setProfile);
          })
          .finally(() => setLoading(false));
      }, 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, refreshProfile]);

  const value = useMemo(
    () => ({
      loading,
      profile,
      isAdmin: profile?.role === 'admin',
      refreshProfile,
      signOut: async () => {
        clearAuthState(activeUserIdRef, setProfile);
        await supabase.auth.signOut();
        navigate('/agent-login', { replace: true });
      },
    }),
    [loading, profile, navigate, refreshProfile],
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
