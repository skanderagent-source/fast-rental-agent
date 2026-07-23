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

const JS_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/javascript; charset=utf-8',
};

export default function handler() {
  const values = Object.fromEntries(
    PUBLIC_KEYS.map((key) => [key, process.env[key] ?? '']),
  );
  const missing = PUBLIC_KEYS.filter((key) => !String(values[key]).trim());

  if (missing.length) {
    const message =
      '[LogiGo] Missing Vercel env: '
      + missing.join(', ')
      + '. Set them in Project Settings > Environment Variables (Production + Preview).';
    return new Response(
      'console.error(' + JSON.stringify(message) + ');',
      { status: 500, headers: JS_HEADERS },
    );
  }

  for (const key of ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_PUBLIC_SITE_URL']) {
    values[key] = String(values[key]).replace(/\/+$/, '');
  }

  return new Response(
    'window.__FAST_RENTAL_ENV__=' + JSON.stringify(values) + ';',
    { status: 200, headers: JS_HEADERS },
  );
}
