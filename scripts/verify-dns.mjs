#!/usr/bin/env node
/**
 * Phase 23: Verify DNS resolves to expected targets.
 */
const apiHost = process.env.API_DOMAIN;
const frontendHost = process.env.FRONTEND_DOMAIN;

if (!apiHost && !frontendHost) {
  console.log('Set API_DOMAIN and/or FRONTEND_DOMAIN to verify DNS.');
  console.log('Example: API_DOMAIN=api.example.com FRONTEND_DOMAIN=agent.example.com node scripts/verify-dns.mjs');
  process.exit(0);
}

async function check(host, label) {
  try {
    const res = await fetch(`https://${host}/health`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) console.log(`✓ ${label} ${host} → HTTP ${res.status}`);
    else console.warn(`⚠ ${label} ${host} → HTTP ${res.status}`);
  } catch (err) {
    console.error(`✗ ${label} ${host}:`, err.message);
    process.exitCode = 1;
  }
}

if (apiHost) await check(apiHost, 'API');
if (frontendHost) {
  try {
    const res = await fetch(`https://${frontendHost}/`, { signal: AbortSignal.timeout(8000) });
    console.log(`✓ Frontend ${frontendHost} → HTTP ${res.status}`);
  } catch (err) {
    console.error(`✗ Frontend ${frontendHost}:`, err.message);
    process.exitCode = 1;
  }
}
