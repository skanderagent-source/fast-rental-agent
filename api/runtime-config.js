/** Vercel Edge: inject public frontend config at request time (not build time). */
export const config = {
  runtime: 'edge',
};

const PUBLIC_KEYS = [
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_PUBLIC_SITE_URL',
];

export default function handler() {
  const values = Object.fromEntries(
    PUBLIC_KEYS.map((key) => [key, process.env[key] ?? '']),
  );
  const missing = PUBLIC_KEYS.filter((key) => !values[key]?.trim());

  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/javascript; charset=utf-8',
  };

  if (missing.length) {
    const body = `console.error("[LogiGo] Missing Vercel env: ${missing.join(', ')}. `
      + 'Set them in Project → Settings → Environment Variables (Production + Preview).");`;
    return new Response(body, { status: 500, headers });
  }

  for (const key of ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_PUBLIC_SITE_URL']) {
    values[key] = values[key].replace(/\/+$/, '');
  }

  const body = `window.__FAST_RENTAL_ENV__=${JSON.stringify(values)};`;
  return new Response(body, { status: 200, headers });
}
