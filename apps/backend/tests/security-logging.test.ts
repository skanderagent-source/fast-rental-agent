import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockChain } from './helpers/mockChain.js';

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
import { logger } from '../src/config/logger.js';

describe('security logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('assigns a request identifier to API responses', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('logs structured auth failures without a bearer token', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({
          event: 'auth_failure',
          reason: 'missing_token',
          statusCode: 401,
          requestId: expect.any(String),
        }),
      }),
      'security_event',
    );
  });

  it('logs structured authorization failures for agents on admin routes', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'agent-1', email: 'agent@test.com' } },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'agent-1', nom: 'Agent', actif: true, role: 'agent' }, error: null });
      }
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(403);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({
          event: 'authz_failure',
          reason: 'permission_denied',
          statusCode: 403,
        }),
      }),
      'security_event',
    );
  });
});
