declare global {
  interface Window {
    __FAST_RENTAL_ENV__?: Record<string, string>;
  }
}

const RUNTIME_CONFIG_PATH = '/api/runtime-config.js';
const RUNTIME_CONFIG_PREFIX = 'window.__FAST_RENTAL_ENV__=';

function parseRuntimeConfigScript(source: string): Record<string, string> | null {
  const start = source.indexOf(RUNTIME_CONFIG_PREFIX);
  if (start === -1) return null;

  const jsonStart = start + RUNTIME_CONFIG_PREFIX.length;
  const jsonEnd = source.indexOf(';', jsonStart);
  if (jsonEnd === -1) return null;

  try {
    const parsed = JSON.parse(source.slice(jsonStart, jsonEnd)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

/** Ensure runtime config is present before env.ts initializes the app modules. */
export async function ensureRuntimeEnv(): Promise<void> {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  if (window.__FAST_RENTAL_ENV__) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(RUNTIME_CONFIG_PATH, { cache: 'no-store' });
      if (!res.ok) continue;

      const source = await res.text();
      const values = parseRuntimeConfigScript(source);
      if (values) {
        window.__FAST_RENTAL_ENV__ = values;
        return;
      }
    } catch {
      // Retry below.
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
}
