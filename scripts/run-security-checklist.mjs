#!/usr/bin/env node
/**
 * Phase 24: Automated production security checklist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { backendEnv, frontendEnv, rootDir } from './lib/env.mjs';

const errors = [];
const root = rootDir();

function ok(msg) { console.log(`✓ ${msg}`); }
function fail(msg) { errors.push(msg); console.error(`✗ ${msg}`); }
function sourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(absolute));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

// Secrets not in frontend
const feText = fs.existsSync(path.join(root, 'apps/frontend/.env'))
  ? fs.readFileSync(path.join(root, 'apps/frontend/.env'), 'utf8') : '';
for (const secret of ['SUPABASE_SERVICE_ROLE_KEY', 'R2_SECRET_ACCESS_KEY', 'RESEND_API_KEY']) {
  if (feText.includes(secret)) fail(`${secret} in frontend .env`);
  else ok(`${secret} not in frontend .env`);
}

// Backend env
const be = backendEnv();
if (be.FRONTEND_ORIGIN?.includes('*')) fail('FRONTEND_ORIGIN must not use wildcard');
else ok('FRONTEND_ORIGIN is explicit');

// Helmet + rate limit in app.ts
const appTs = fs.readFileSync(path.join(root, 'apps/backend/src/app.ts'), 'utf8');
if (appTs.includes('helmet')) ok('Helmet middleware present');
else fail('Helmet missing');
if (appTs.includes('rateLimit')) ok('Rate limiter present');
else fail('Rate limiter missing');
if (appTs.includes("'req.headers.authorization'")
  && appTs.includes('req.headers.cookie')
  && appTs.includes('req.body.password')) {
  ok('Authentication and sensitive request fields redacted from logs');
} else {
  fail('Sensitive authentication headers are not redacted from logs');
}
if (/RATE_LIMIT_API_MAX/.test(appTs)) ok('Authenticated API rate limit configured');
else fail('Authenticated API rate limit missing');
if (appTs.includes("app.disable('x-powered-by')")) ok('Express technology disclosure disabled');
else fail('Express x-powered-by is not explicitly disabled');
if (appTs.includes('enforceHttps')) ok('Production HTTPS fallback present');
else fail('Production HTTPS fallback missing');
if (appTs.includes("frameAncestors: [\"'none'\"]") && appTs.includes('Permissions-Policy')) {
  ok('API browser security headers configured');
} else {
  fail('API CSP or Permissions-Policy incomplete');
}
if (appTs.includes('credentials: false')
  && appTs.includes("allowedHeaders: ['Authorization', 'Content-Type', 'X-Action-Token']")) {
  ok('API CORS credentials and headers restricted');
} else {
  fail('API CORS policy is too broad');
}
if (appTs.includes("app.set('trust proxy', 'loopback')")) ok('Express trusts only loopback proxy');
else fail('Express trust proxy is not restricted to loopback');
if (appTs.includes('enforceApiRoutePolicy')) ok('API preflight and method registry enabled');
else fail('API preflight/method registry missing');
if (appTs.includes('preventPrivateResponseCaching')) ok('Authenticated API cache prevention enabled');
else fail('Authenticated API cache prevention missing');
if (appTs.includes('attachRequestId') && appTs.includes('genReqId')) ok('Request identifiers attached to API traffic');
else fail('Request identifier middleware missing');
if (appTs.includes('req.body.password') && appTs.includes('req.headers.cookie')) {
  ok('Expanded log redaction configured');
} else {
  fail('Log redaction paths incomplete');
}

const securityLogTs = fs.readFileSync(path.join(root, 'apps/backend/src/utils/securityLog.ts'), 'utf8');
if (securityLogTs.includes('security_event') && securityLogTs.includes('auth_failure')) {
  ok('Structured security event logging present');
} else {
  fail('Structured security event logging missing');
}
if (appTs.includes("express.json({ limit: '2mb', strict: true, type: 'application/json' })")
  && appTs.includes("express.urlencoded({ extended: false, limit: '64kb'")
  && appTs.includes("express.text({ type: 'text/plain', limit: '64kb'")) {
  ok('JSON, form, and text body limits configured');
} else {
  fail('Request body parser limits incomplete');
}

const validateRequest = fs.readFileSync(
  path.join(root, 'apps/backend/src/middleware/validateRequest.ts'),
  'utf8',
);
if (validateRequest.includes('UNSUPPORTED_MEDIA_TYPE')
  && validateRequest.includes("req.is('application/json')")) {
  ok('JSON API content types enforced');
} else {
  fail('Strict JSON content-type enforcement missing');
}

const requestBoundary = fs.readFileSync(
  path.join(root, 'apps/backend/src/middleware/requestBoundary.ts'),
  'utf8',
);
if (requestBoundary.includes("'TRACE', 'TRACK', 'CONNECT'")) ok('Raw HTTP methods blocked');
else fail('TRACE/TRACK/CONNECT boundary missing');
if (requestBoundary.includes('INVALID_HOST') && requestBoundary.includes('AMBIGUOUS_REQUEST')) {
  ok('Host and ambiguous request validation enabled');
} else {
  fail('Host or request normalization checks missing');
}

const serverTs = fs.readFileSync(path.join(root, 'apps/backend/src/server.ts'), 'utf8');
if (serverTs.includes('maxHeaderSize')
  && serverTs.includes('headersTimeout')
  && serverTs.includes('requestTimeout')
  && serverTs.includes('keepAliveTimeout')
  && serverTs.includes('registerGracefulShutdown')) {
  ok('Node header, timeout, and graceful shutdown configured');
} else {
  fail('Node header, timeout, or graceful shutdown controls incomplete');
}
if (!/db push|migration|supabase db/.test(serverTs)) {
  ok('Database migrations are not executed during API startup');
} else {
  fail('Database migrations appear to run during API startup');
}

const supabaseAdminTs = fs.readFileSync(path.join(root, 'apps/backend/src/db/supabaseAdmin.ts'), 'utf8');
if (supabaseAdminTs.includes('DB_QUERY_TIMEOUT_MS') && supabaseAdminTs.includes('AbortSignal.timeout')) {
  ok('Supabase query timeout configured');
} else {
  fail('Supabase query timeout missing');
}

const schemasTs = fs.readFileSync(path.join(root, 'shared/src/schemas.ts'), 'utf8');
const paramsTs = fs.readFileSync(path.join(root, 'apps/backend/src/utils/params.ts'), 'utf8');
if (schemasTs.includes('.strict()') && paramsTs.includes('UUID_PATTERN')) {
  ok('Strict request schemas and UUID parameter validation enabled');
} else {
  fail('API input validation hardening incomplete');
}

const inputSafety = fs.readFileSync(
  path.join(root, 'apps/backend/src/middleware/inputSafety.ts'),
  'utf8',
);
if (inputSafety.includes('DUPLICATE_QUERY_PARAMETER')
  && inputSafety.includes('DANGEROUS_OBJECT_KEY')) {
  ok('Parameter pollution and prototype pollution checks enabled');
} else {
  fail('Parameter/prototype pollution controls missing');
}

const publicRoutes = fs.readFileSync(path.join(root, 'apps/backend/src/routes/public.routes.ts'), 'utf8');
const responseSchemas = fs.readFileSync(path.join(root, 'apps/backend/src/routes/public.schemas.ts'), 'utf8');
if (publicRoutes.includes('sendValidatedData')
  && responseSchemas.includes('publicMediaResponseSchema')
  && responseSchemas.includes('.strip()')) {
  ok('Public response schema projection enabled');
} else {
  fail('Public response schema enforcement missing');
}
if (appTs.includes("app.set('json escape', true)")) ok('Express JSON output escaping enabled');
else fail('Express JSON output escaping missing');

const authorization = fs.readFileSync(path.join(root, 'apps/backend/src/middleware/requireRole.ts'), 'utf8');
const authRoutes = [
  'apps/backend/src/modules/admin/admin.routes.ts',
  'apps/backend/src/modules/users/users.routes.ts',
  'apps/backend/src/modules/listings/listings.routes.ts',
  'apps/backend/src/modules/leads/leads.routes.ts',
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
if (authorization.includes('requirePermission')
  && authRoutes.includes("requirePermission('users.manage')")
  && authRoutes.includes("requirePermission('listings.manage')")) {
  ok('Fine-grained admin permissions enforced');
} else {
  fail('Admin permission-scope enforcement missing');
}
const actionTokens = fs.readFileSync(
  path.join(root, 'apps/backend/src/modules/auth/actionTokens.service.ts'),
  'utf8',
);
const actionTokenMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/0027_security_action_tokens.sql'),
  'utf8',
);
if (actionTokens.includes("createHash('sha256')")
  && actionTokens.includes('randomBytes(32)')
  && actionTokenMigration.includes('enable row level security')) {
  ok('One-time sensitive action tokens are hashed and database-backed');
} else {
  fail('One-time sensitive action token controls missing');
}

const listingsService = fs.readFileSync(
  path.join(root, 'apps/backend/src/modules/listings/listings.service.ts'),
  'utf8',
);
if (listingsService.includes('LISTING_WRITABLE_FIELDS')
  && listingsService.includes('pickListingWrites')) {
  ok('Listing persistence uses writable-field allowlist');
} else {
  fail('Listing mass-assignment protection missing');
}

const rentalsService = fs.readFileSync(
  path.join(root, 'apps/backend/src/modules/rentals/rentals.service.ts'),
  'utf8',
);
if (rentalsService.includes('assigne_a') && rentalsService.includes('deleted_at')) {
  ok('Rental creation enforces lead assignment and listing existence');
} else {
  fail('Rental object-level authorization missing');
}

const applicationSources = [
  ...sourceFiles(path.join(root, 'apps/backend/src')),
  ...sourceFiles(path.join(root, 'apps/frontend/src')),
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
if (!/\beval\s*\(|new\s+Function\b|node:vm|from\s+['"](?:js-)?yaml['"]/.test(applicationSources)) {
  ok('No unsafe dynamic evaluation or YAML deserialization found');
} else {
  fail('Unsafe dynamic evaluation/deserialization primitive found');
}
const packageText = [
  fs.readFileSync(path.join(root, 'apps/backend/package.json'), 'utf8'),
  fs.readFileSync(path.join(root, 'apps/frontend/package.json'), 'utf8'),
].join('\n');
if (!/"(?:mongoose|mongodb|redis|ioredis)"\s*:/.test(packageText)) {
  ok('No NoSQL datastore dependency in application runtime');
} else {
  fail('NoSQL dependency requires a dedicated injection review');
}

// Frontend and reverse-proxy delivery headers
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const vercelHeaders = vercel.headers?.flatMap((rule) => rule.headers ?? []) ?? [];
const headerValue = (key) => vercelHeaders.find((header) => header.key === key)?.value ?? '';
const vercelCsp = headerValue('Content-Security-Policy');
if (vercelCsp.includes("frame-ancestors 'none'")
  && vercelCsp.includes("script-src 'self'")
  && !/script-src[^;]*unsafe-inline/.test(vercelCsp)) {
  ok('Frontend CSP blocks framing and inline scripts');
} else {
  fail('Frontend CSP is missing or permits inline scripts');
}
for (const header of [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
]) {
  if (headerValue(header)) ok(`Vercel ${header} configured`);
  else fail(`Vercel ${header} missing`);
}

const viteConfig = fs.readFileSync(path.join(root, 'apps/frontend/vite.config.ts'), 'utf8');
if (viteConfig.includes('VITE_API_BASE_URL')
  && viteConfig.includes('VITE_SUPABASE_URL')
  && viteConfig.includes("script-src 'self'")) {
  ok('Production CSP uses exact build-time service origins');
} else {
  fail('Production CSP origin generation missing');
}
if (viteConfig.includes('sourcemap: mode !== \'production\'')) {
  ok('Frontend production builds omit source maps');
} else {
  fail('Frontend production source map policy missing');
}

const frontendSrc = sourceFiles(path.join(root, 'apps/frontend/src')).map((file) =>
  fs.readFileSync(file, 'utf8'),
).join('\n');
if (fs.existsSync(path.join(root, 'apps/frontend/src/lib/urlSafetyCore.ts'))
  && frontendSrc.includes('openUrlSafely')
  && frontendSrc.includes('isSafeMediaUrl')) {
  ok('Frontend URL safety helpers present');
} else {
  fail('Frontend URL safety helpers missing');
}
if (!/window\.open\([^)]*,\s*['"]_blank['"]\s*\)/.test(frontendSrc)) {
  ok('Frontend avoids raw window.open without noopener');
} else {
  fail('Frontend still uses raw window.open');
}
const frontendEnvTs = fs.readFileSync(path.join(root, 'apps/frontend/src/lib/env.ts'), 'utf8');
if (frontendEnvTs.includes('import.meta.env.PROD') && frontendEnvTs.includes('must use HTTPS in production')) {
  ok('Frontend production env enforces HTTPS service URLs');
} else {
  fail('Frontend production HTTPS env validation missing');
}
if (frontendSrc.includes('clearClientSession') && frontendSrc.includes('credentials: \'omit\'')) {
  ok('Frontend clears client session and omits credentialed API fetches');
} else {
  fail('Frontend client session cleanup or credentials policy missing');
}
if (frontendSrc.includes('sessionStorage') && frontendSrc.includes('AppErrorBoundary')) {
  ok('Frontend uses tab-scoped auth storage and a safe error boundary');
} else {
  fail('Frontend auth storage or error boundary hardening missing');
}
if (/esbuild:\s*\{[\s\S]*drop:\s*mode === 'production' \? \['console', 'debugger'\]/.test(viteConfig)) {
  ok('Frontend production build strips debug logging');
} else {
  fail('Frontend production console stripping missing');
}
if (frontendSrc.includes('parseApi') && frontendSrc.includes('parseListingCreatePayload') && frontendSrc.includes('useSubmitLock')) {
  ok('Frontend runtime validation and submit locks present');
} else {
  fail('Frontend runtime validation or submit-lock helpers missing');
}
if (frontendSrc.includes('PasswordInput') && frontendSrc.includes('enforceCurrentAppBuild')) {
  ok('Frontend password masking and build refresh checks present');
} else {
  fail('Frontend password masking or build refresh checks missing');
}
if (frontendSrc.includes('sanitizeFieldInput') && frontendSrc.includes('SanitizedInput')) {
  ok('Frontend typed input sanitization present');
} else {
  fail('Frontend typed input sanitization missing');
}
if (frontendEnvTs.includes('Object.freeze')) {
  ok('Frontend runtime env object is frozen after validation');
} else {
  fail('Frontend runtime env freeze missing');
}

const caddy = fs.readFileSync(path.join(root, 'deploy/Caddyfile'), 'utf8');
if (/redir https:\/\//.test(caddy) && caddy.includes('Strict-Transport-Security')) {
  ok('Caddy HTTPS redirect and HSTS configured');
} else {
  fail('Caddy HTTPS redirect or HSTS missing');
}
if (caddy.includes('-Server')) ok('Caddy Server header removed');
else fail('Caddy Server header disclosure remains');
if (caddy.includes('read_header 15s')
  && caddy.includes('max_header_size 16KB')
  && caddy.includes('protocols tls1.2 tls1.3')
  && caddy.includes('@blocked_methods method TRACE TRACK CONNECT')) {
  ok('Caddy slow-client, TLS, and raw-method controls configured');
} else {
  fail('Caddy timeout/header/method/TLS controls incomplete');
}

const r2Cors = fs.readFileSync(path.join(root, 'deploy/r2-cors.json'), 'utf8');
if (!r2Cors.includes('"AllowedHeaders": ["*"]')) ok('R2 CORS request headers restricted');
else fail('R2 CORS allows wildcard request headers');

// RLS migrations
const rls = fs.readFileSync(path.join(root, 'supabase/migrations/0002_rls.sql'), 'utf8');
if (/enable row level security/i.test(rls)) ok('RLS migration present');
else fail('RLS migration incomplete');

// Git tracked .env
try {
  const tracked = execSync('git ls-files', { encoding: 'utf8', cwd: root });
  for (const line of tracked.split('\n')) {
    if (line.endsWith('.env')) fail(`.env tracked: ${line}`);
  }
  ok('No .env files tracked by git');
} catch {
  ok('Git check skipped (not a repo)');
}

if (fs.existsSync(path.join(root, 'package-lock.json'))) ok('Root package-lock.json present');
else fail('package-lock.json missing');

const rootPkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
if (rootPkg.includes('"audit:deps"')) ok('Dependency audit script configured');
else fail('Dependency audit script missing');

if (rootPkg.includes('"scan-secrets"')) ok('CI secret scanning script configured');
else fail('CI secret scanning script missing');

const backendBuildTs = fs.readFileSync(path.join(root, 'apps/backend/tsconfig.build.json'), 'utf8');
if (backendBuildTs.includes('"sourceMap": false')) ok('Backend production build omits source maps');
else fail('Backend production source map policy missing');

const vercelJson = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
if (vercelJson.includes('\\.map') && vercelJson.includes('"status": 404')) {
  ok('Vercel blocks public source map access');
} else {
  fail('Vercel source map exposure control missing');
}

const envTs = fs.readFileSync(path.join(root, 'apps/backend/src/config/env.ts'), 'utf8');
if (/schema\.safeParse\(process\.env\)/.test(envTs) && envTs.includes('superRefine')) {
  ok('Backend runtime configuration validated with Zod at startup');
} else {
  fail('Backend runtime configuration schema validation missing');
}

if (appTs.includes('rejectCompressedRequestBody')) {
  ok('Compressed request bodies rejected before parsing');
} else {
  fail('Compressed request body rejection missing');
}

if (appTs.includes('FRONTEND_ORIGIN') || envTs.includes('FRONTEND_ORIGIN')) {
  ok('CORS origins loaded from validated server-side configuration');
} else {
  fail('Server-side CORS configuration validation missing');
}

const backendRuntimeSources = sourceFiles(path.join(root, 'apps/backend/src')).map((file) =>
  fs.readFileSync(file, 'utf8'),
).join('\n');
if (!/child_process|execSync|spawn\(/.test(backendRuntimeSources)) {
  ok('Backend runtime does not shell out to child processes');
} else {
  fail('Backend runtime child-process execution requires review');
}

if (errors.length) {
  console.error(`\n${errors.length} security check(s) failed`);
  process.exit(1);
}
console.log('\n✓ Automated security checklist passed');
console.log('Complete manual items in docs/security-checklist.md before sign-off');
