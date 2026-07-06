import { backendEnv, frontendEnv } from './env.mjs';

function isPlaceholder(value) {
  if (!value || String(value).trim() === '') return true;
  return /your-|changeme|xxx|example\.com/i.test(String(value));
}

export function credentialStatus() {
  const be = { ...backendEnv(), ...process.env };
  const fe = { ...frontendEnv(), ...process.env };

  return {
    supabase: {
      url: !!be.SUPABASE_URL && !isPlaceholder(be.SUPABASE_URL),
      anon: !!be.SUPABASE_ANON_KEY && !isPlaceholder(be.SUPABASE_ANON_KEY),
      serviceRole: !!be.SUPABASE_SERVICE_ROLE_KEY && !isPlaceholder(be.SUPABASE_SERVICE_ROLE_KEY),
    },
    r2: {
      account: !!be.R2_ACCOUNT_ID && !isPlaceholder(be.R2_ACCOUNT_ID),
      accessKey: !!be.R2_ACCESS_KEY_ID && !isPlaceholder(be.R2_ACCESS_KEY_ID),
      secret: !!be.R2_SECRET_ACCESS_KEY && !isPlaceholder(be.R2_SECRET_ACCESS_KEY),
      bucket: !!be.R2_BUCKET && !isPlaceholder(be.R2_BUCKET),
    },
    email: {
      resend: !!be.RESEND_API_KEY && !isPlaceholder(be.RESEND_API_KEY),
      enabled: String(be.EMAIL_ENABLED).toLowerCase() === 'true',
    },
    google: {
      sa: !!be.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!be.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
        && !isPlaceholder(be.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    },
    frontend: {
      anon: !!fe.VITE_SUPABASE_ANON_KEY && !isPlaceholder(fe.VITE_SUPABASE_ANON_KEY),
    },
    dns: {
      apiDomain: !!process.env.API_DOMAIN,
      frontendDomain: !!process.env.FRONTEND_DOMAIN,
    },
  };
}

export function hasLiveSupabase(creds = credentialStatus()) {
  return creds.supabase.url && creds.supabase.anon && creds.supabase.serviceRole;
}

export function hasLiveR2(creds = credentialStatus()) {
  return creds.r2.account && creds.r2.accessKey && creds.r2.secret && creds.r2.bucket;
}
