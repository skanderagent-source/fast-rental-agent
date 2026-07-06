import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockChain } from './helpers/mockChain.js';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('../src/db/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('../src/modules/media/r2.service.js', () => ({
  createUploadUrl: vi.fn().mockResolvedValue('https://r2.example/upload'),
  createDownloadUrl: vi.fn().mockResolvedValue('https://r2.example/view'),
  deleteObject: vi.fn(),
  objectExists: vi.fn().mockResolvedValue(true),
}));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null }) },
  })),
}));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null }) },
  })),
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    EMAIL_ENABLED: false,
    FRONTEND_ORIGIN: 'http://localhost:5173',
    RATE_LIMIT_PUBLIC_WINDOW_MS: 60000,
    RATE_LIMIT_PUBLIC_MAX: 30,
    R2_BUCKET: 'test',
    R2_SIGNED_DOWNLOAD_EXPIRES_SECONDS: 3600,
  },
}));

import { app } from '../src/app.js';
import { logger } from '../src/config/logger.js';

describe('leads API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  it('validates public lead body', async () => {
    const res = await request(app).post('/api/public/leads').send({});
    expect(res.status).toBe(400);
  });

  it('creates public lead without auth', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'demandes_clients') {
        return mockChain({
          data: {
            id: 'lead-1',
            nom: 'Jean',
            email: 'client@test.com',
            ref_agent_id: null,
            listing_id: null,
            type_demande: 'rappel',
          },
          error: null,
        });
      }
      if (table === 'agents') return mockChain({ data: [{ email: 'admin@test.com' }], error: null });
      return mockChain({ data: [], error: null });
    });
    const res = await request(app).post('/api/public/leads').send({
      nom: 'Jean Test',
      typeDemande: 'rappel',
      email: 'client@test.com',
    });
    expect(res.status).toBe(201);
  });

  it('stores suggested ref_agent_id without auto-assigning', async () => {
    const agentId = '00000000-0000-4000-8000-000000000001';
    let agentCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'demandes_clients') {
        return mockChain({
          data: {
            id: 'lead-1',
            nom: 'Jean',
            ref_agent_id: agentId,
            assigne_a: null,
            listing_id: null,
            type_demande: 'rappel',
          },
          error: null,
        });
      }
      if (table === 'agents') {
        agentCalls += 1;
        if (agentCalls === 1) {
          return mockChain({ data: { id: agentId, nom: 'Marie', actif: true }, error: null });
        }
        return mockChain({ data: [], error: null });
      }
      return mockChain({ data: [], error: null });
    });
    const res = await request(app).post('/api/public/leads').send({
      nom: 'Jean Test',
      typeDemande: 'rappel',
      refAgentId: agentId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.ref_agent_id).toBe(agentId);
    expect(res.body.data.assigne_a).toBeNull();
  });

  it('assigns lead and archives with delete_after', async () => {
    const agentUuid = '00000000-0000-4000-8000-000000000002';
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@test.com' } },
      error: null,
    });
    let agentQuery = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        agentQuery += 1;
        if (agentQuery === 1) {
          return mockChain({ data: { id: 'admin-1', nom: 'Admin', actif: true, role: 'admin' }, error: null });
        }
        return mockChain({
          data: { id: agentUuid, nom: 'Agent', email: 'agent@test.com', actif: true },
          error: null,
        });
      }
      if (table === 'demandes_clients') {
        return mockChain({
          data: {
            id: 'lead-1',
            nom: 'Jean',
            statut: 'archivé',
            assigne_a: agentUuid,
            delete_after: '2030-02-01T00:00:00.000Z',
            listing_id: null,
            type_demande: 'rappel',
          },
          error: null,
        });
      }
      if (table === 'activite') return mockChain({ data: {}, error: null });
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .post('/api/leads/00000000-0000-4000-8000-000000000099/assign')
      .set('Authorization', 'Bearer t')
      .send({ agentId: agentUuid });
    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('archivé');
    expect(res.body.data.delete_after).toBeTruthy();
  });

  it('sends admin and client emails on public lead when email present', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'demandes_clients') {
        return mockChain({
          data: { id: 'l1', nom: 'Jean', email: 'client@test.com', listing_id: null, type_demande: 'rappel' },
          error: null,
        });
      }
      if (table === 'agents') {
        return mockChain({ data: [{ email: 'admin1@test.com' }, { email: 'admin2@test.com' }], error: null });
      }
      return mockChain({ data: [], error: null });
    });
    await request(app).post('/api/public/leads').send({
      nom: 'Jean',
      typeDemande: 'rappel',
      email: 'client@test.com',
    });
    await new Promise((r) => setTimeout(r, 30));
    const skipped = (logger.info as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[1] === 'Email skipped (EMAIL_ENABLED=false)',
    );
    expect(skipped.length).toBeGreaterThanOrEqual(3);
  });
});
