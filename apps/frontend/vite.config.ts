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

const REPO_ROOT = path.resolve(__dirname, '../..');

const PRODUCTION_CSP_ENV_KEYS = [
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_PUBLIC_SITE_URL',
] as const;

/** Used when env vars are available at build time (local prod builds). Vercel uses vercel.json CSP + runtime config. */
function resolveProductionEnv(mode: string): Record<string, string> {
  const fromFrontend = loadEnv(mode, __dirname, 'VITE_');
  const fromRoot = loadEnv(mode, REPO_ROOT, 'VITE_');
  const merged = { ...fromRoot, ...fromFrontend };
  for (const name of PRODUCTION_CSP_ENV_KEYS) {
    const fromProcess = process.env[name];
    if (fromProcess !== undefined && fromProcess !== '') {
      merged[name] = fromProcess;
    }
  }
  return merged;
}

function hasProductionCspEnv(env: Record<string, string>): boolean {
  return PRODUCTION_CSP_ENV_KEYS.every((name) => Boolean(env[name]?.trim()));
}

function requireProductionUrl(env: Record<string, string>, name: (typeof PRODUCTION_CSP_ENV_KEYS)[number]): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be a valid absolute URL to build the production CSP (got empty)`);
  }
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${name} must be a valid absolute URL to build the production CSP (got ${JSON.stringify(value)})`);
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

/** Vercel serves public config from /api/runtime-config.js at request time. */
function productionRuntimeConfigPlugin(mode: string): Plugin {
  return {
    name: 'fast-rental-production-runtime-config',
    transformIndexHtml(html) {
      if (mode !== 'production') return html;
      return {
        html,
        tags: [{
          tag: 'script',
          attrs: { src: '/api/runtime-config.js' },
          injectTo: 'head-prepend',
        }],
      };
    },
  };
}

function productionCspPlugin(mode: string): Plugin {
  return {
    name: 'fast-rental-production-csp',
    transformIndexHtml(html) {
      if (mode !== 'production') return html;

      const env = resolveProductionEnv(mode);
      if (!hasProductionCspEnv(env)) {
        // Vercel builds without build-time env: CSP comes from vercel.json connect-src.
        return html;
      }

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
    plugins: [
      sharedLogoPlugin(),
      react(),
      productionRuntimeConfigPlugin(mode),
      productionCspPlugin(mode),
    ],
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
