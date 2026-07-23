import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedLogoDir = path.resolve(__dirname, '../../shared/logo');
const faviconSrc = path.join(sharedLogoDir, 'favicon.ico');
const faviconDest = path.join(__dirname, 'public/favicon.ico');
const frontendPkg = JSON.parse(
  readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
) as { version: string };

const PRODUCTION_CSP_ENV_KEYS = [
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_PUBLIC_SITE_URL',
] as const;

function resolveProductionEnv(mode: string): Record<string, string> {
  const envDir = __dirname;
  const fromFiles = loadEnv(mode, envDir, '');
  const merged = { ...fromFiles };
  for (const name of PRODUCTION_CSP_ENV_KEYS) {
    const fromProcess = process.env[name];
    if (fromProcess) merged[name] = fromProcess;
  }
  return merged;
}

function requireProductionUrl(env: Record<string, string>, name: (typeof PRODUCTION_CSP_ENV_KEYS)[number]): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required for production builds (set it in the Vercel project Environment Variables for Production and Preview, or in apps/frontend/.env for local builds)`,
    );
  }
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${name} must be a valid absolute URL to build the production CSP (got ${JSON.stringify(value)})`);
  }
}

function assertProductionHttpsUrls(env: Record<string, string>) {
  for (const name of ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_PUBLIC_SITE_URL'] as const) {
    const value = env[name];
    if (!value) continue;
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw new Error(`${name} must use HTTPS in production builds to avoid mixed content (got ${url.protocol})`);
    }
  }
}

function sharedLogoPlugin(): Plugin {
  const syncFavicon = () => {
    if (!existsSync(faviconSrc)) {
      throw new Error(`Missing favicon source: ${faviconSrc}`);
    }
    copyFileSync(faviconSrc, faviconDest);
  };

  return {
    name: 'shared-logo-favicon',
    buildStart: syncFavicon,
    configureServer() {
      syncFavicon();
    },
  };
}

function productionCspPlugin(mode: string): Plugin {
  return {
    name: 'fast-rental-production-csp',
    transformIndexHtml(html) {
      if (mode !== 'production') return html;

      const env = resolveProductionEnv(mode);
      assertProductionHttpsUrls(env);
      const apiOrigin = requireProductionUrl(env, 'VITE_API_BASE_URL');
      const supabaseOrigin = requireProductionUrl(env, 'VITE_SUPABASE_URL');
      const supabaseWebSocket = supabaseOrigin.replace(/^https:/, 'wss:');
      const policy = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        "script-src 'self'",
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.tile.openstreetmap.org",
        "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
        `connect-src 'self' ${apiOrigin} ${supabaseOrigin} ${supabaseWebSocket} https://*.r2.cloudflarestorage.com`,
        "font-src 'self' data:",
        "manifest-src 'self'",
        "worker-src 'self' blob:",
        'upgrade-insecure-requests',
      ].join('; ');

      return {
        html,
        tags: [{
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: policy,
          },
          injectTo: 'head-prepend',
        }],
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? frontendPkg.version;

  return {
    plugins: [sharedLogoPlugin(), react(), productionCspPlugin(mode)],
    resolve: {
      alias: {
        '@shared/logo': path.resolve(__dirname, '../../shared/logo'),
      },
    },
    define: {
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    build: {
      sourcemap: mode !== 'production',
    },
    server: {
      // Fast Rental agent UI — Union Rental owns :5174; fail instead of auto-bumping.
      port: 5173,
      strictPort: true,
    },
  };
});
