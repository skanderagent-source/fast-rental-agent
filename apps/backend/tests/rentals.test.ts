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

describe('rentals API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects rental creation when the lead is assigned to another agent', async () => {
    const agentUuid = '00000000-0000-4000-8000-000000000002';
    const otherAgentUuid = '00000000-0000-4000-8000-000000000003';
    const listingId = '00000000-0000-4000-8000-000000000010';
    const leadId = '00000000-0000-4000-8000-000000000099';

    authAs(mockGetUser, mockFrom, { id: agentUuid, role: 'agent' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: agentUuid, nom: 'Agent', actif: true, role: 'agent' }, error: null });
      }
      if (table === 'logements') {
        return mockChain({ data: { id: listingId }, error: null });
      }
      if (table === 'demandes_clients') {
        return mockChain({ data: { id: leadId, assigne_a: otherAgentUuid }, error: null });
      }
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .post('/api/rentals')
      .set('Authorization', 'Bearer fake-token')
      .send({ listingId, leadId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects rental creation for deleted listings', async () => {
    const agentUuid = '00000000-0000-4000-8000-000000000002';
    const listingId = '00000000-0000-4000-8000-000000000010';

    authAs(mockGetUser, mockFrom, { id: agentUuid, role: 'agent' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: agentUuid, nom: 'Agent', actif: true, role: 'agent' }, error: null });
      }
      if (table === 'logements') {
        return mockChain({ data: null, error: null });
      }
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .post('/api/rentals')
      .set('Authorization', 'Bearer fake-token')
      .send({ listingId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
