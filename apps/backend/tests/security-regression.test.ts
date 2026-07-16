import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authAs, mockChain } from './helpers/mockChain.js';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('../src/db/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: vi.fn(),
  },
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    EMAIL_ENABLED: false,
    FRONTEND_ORIGIN: 'http://localhost:5173',
    RATE_LIMIT_PUBLIC_WINDOW_MS: 60000,
    RATE_LIMIT_PUBLIC_MAX: 30,
    RATE_LIMIT_API_WINDOW_MS: 60000,
    RATE_LIMIT_API_MAX: 300,
    NODE_ENV: 'test',
    R2_BUCKET: 'test',
    R2_SIGNED_DOWNLOAD_EXPIRES_SECONDS: 3600,
  },
}));

import { app } from '../src/app.js';

/**
 * Regression suite for production security controls (items 97–100).
 * Complements focused tests in auth, security-headers, security-hardening, and leads suites.
 */
describe('security regression suite', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('authentication bypass', () => {
    it('rejects missing bearer token on protected routes', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid bearer token on protected routes', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
      const res = await request(app).get('/api/me').set('Authorization', 'Bearer bad-token');
      expect(res.status).toBe(401);
    });
  });

  describe('authorization boundaries', () => {
    it('blocks agents from admin user management', async () => {
      authAs(mockGetUser, mockFrom, { id: 'agent-1', role: 'agent' });
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks lead progress updates from non-assigned agents', async () => {
      const agentUuid = '00000000-0000-4000-8000-000000000002';
      const otherAgentUuid = '00000000-0000-4000-8000-000000000003';
      const leadId = '00000000-0000-4000-8000-000000000099';
      mockGetUser.mockResolvedValue({
        data: { user: { id: agentUuid, email: 'agent@test.com' } },
        error: null,
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'agents') {
          return mockChain({ data: { id: agentUuid, nom: 'Agent', actif: true, role: 'agent' }, error: null });
        }
        if (table === 'demandes_clients') {
          return mockChain({
            data: { id: leadId, assigne_a: otherAgentUuid, traitement_statut: 'contacté' },
            error: null,
          });
        }
        return mockChain({ data: [], error: null });
      });

      const res = await request(app)
        .patch(`/api/leads/${leadId}/progress`)
        .set('Authorization', 'Bearer t')
        .send({ traitementStatut: 'réglé' });

      expect(res.status).toBe(403);
    });
  });

  describe('CSRF posture', () => {
    it('does not use credentialed CORS, so ambient cookie CSRF is out of scope', async () => {
      const res = await request(app)
        .options('/api/me')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  describe('CORS rules', () => {
    it('does not reflect unlisted origins on API responses', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('sensitive response caching', () => {
    it('applies no-store cache policy to authenticated API routes', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
      const res = await request(app).get('/api/me').set('Authorization', 'Bearer t');
      expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
    });

    it('leaves public listing responses without private cache headers', async () => {
      const res = await request(app).get('/api/public/listings');
      expect(res.headers['cache-control']).toBeUndefined();
    });
  });

  describe('rate limiting configuration', () => {
    it('registers separate public and authenticated API limiters outside test mode', async () => {
      const source = await import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../src/app.ts', import.meta.url), 'utf8'),
      );
      expect(source).toContain("skip: (req) => req.originalUrl.startsWith('/api/public')");
      expect(source).toContain('RATE_LIMIT_EXCEEDED');
      expect(source).toContain('attachRetryAfterHeader');
      expect(source).toContain("if (process.env.NODE_ENV !== 'test')");
    });
  });
});
