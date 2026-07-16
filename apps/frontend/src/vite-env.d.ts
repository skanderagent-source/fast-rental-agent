/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PUBLIC_SITE_URL: string;
  readonly VITE_BUILD_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
