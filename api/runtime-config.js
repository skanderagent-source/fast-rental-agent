/** Vercel serverless: inject public frontend config at request time (not build time). */
const PUBLIC_KEYS = [
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_PUBLIC_SITE_URL',
];

module.exports = (_req, res) => {
  const config = Object.fromEntries(
    PUBLIC_KEYS.map((key) => [key, process.env[key] ?? '']),
  );
  const missing = PUBLIC_KEYS.filter((key) => !config[key]?.trim());

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

  if (missing.length) {
    res.status(500).send(
      `console.error("[LogiGo] Missing Vercel env: ${missing.join(', ')}. `
      + 'Set them in Project → Settings → Environment Variables (Production + Preview).");`,
    );
    return;
  }

  res.status(200).send(`window.__FAST_RENTAL_ENV__=${JSON.stringify(config)};`);
