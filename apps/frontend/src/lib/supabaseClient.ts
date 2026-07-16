import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Supabase session tokens live in sessionStorage (tab-scoped, cleared on browser close).
// The app does not store tokens in React state, query caches, or other persisted stores.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
