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
    RATE_LIMIT_API_WINDOW_MS: 60000,
    RATE_LIMIT_API_MAX: 300,
    NODE_ENV: 'test',
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

  it('assigns lead and archives without delete_after', async () => {
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
      if (table === 'activite') return mockChain({ data: {}, error: null });
      return mockChain({ data: [], error: null });
    });
    mockRpc.mockResolvedValue({
      data: {
        id: 'lead-1',
        nom: 'Jean',
        statut: 'archivé',
        assigne_a: agentUuid,
        delete_after: null,
        listing_id: null,
        type_demande: 'rappel',
      },
      error: null,
    });

    const res = await request(app)
      .post('/api/leads/00000000-0000-4000-8000-000000000099/assign')
      .set('Authorization', 'Bearer fake-token')
      .send({ agentId: agentUuid });
    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('archivé');
    expect(res.body.data.delete_after).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('assign_demande_client', {
      p_lead_id: '00000000-0000-4000-8000-000000000099',
      p_agent_id: agentUuid,
      p_assignation_type: 'manual',
    });
  });

  it('lists assigned leads for agents', async () => {
    const agentUuid = '00000000-0000-4000-8000-000000000002';
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
          data: [
            {
              id: 'lead-1',
              nom: 'Jean',
              statut: 'archivé',
              assigne_a: agentUuid,
              delete_after: null,
              traitement_statut: 'assigné',
            },
          ],
          error: null,
          count: 1,
        });
      }
      return mockChain({ data: [], error: null, count: 0 });
    });

    const res = await request(app)
      .get('/api/leads?includeArchived=false')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].assigne_a).toBe(agentUuid);
  });

  it('lists only archived leads for admins when includeArchived=true', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@test.com' } },
      error: null,
    });
    const or = vi.fn().mockReturnThis();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'admin-1', nom: 'Admin', actif: true, role: 'admin' }, error: null });
      }
      if (table === 'demandes_clients') {
        const chain = mockChain({
          data: [{ id: 'lead-archived', nom: 'Marie', statut: 'archivé', assigne_a: 'agent-1' }],
          error: null,
          count: 1,
        });
        chain.or = or;
        return chain;
      }
      if (table === 'logements') {
        return mockChain({ data: [], error: null });
      }
      return mockChain({ data: [], error: null, count: 0 });
    });

    const res = await request(app)
      .get('/api/leads?includeArchived=true')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(or).toHaveBeenCalledWith('assigne_a.not.is.null');
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].assigne_a).toBe('agent-1');
  });

  it('filters archived leads by assigned agent', async () => {
    const agentUuid = '00000000-0000-4000-8000-000000000002';
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@test.com' } },
      error: null,
    });
    const eq = vi.fn().mockReturnThis();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'admin-1', nom: 'Admin', actif: true, role: 'admin' }, error: null });
      }
      if (table === 'demandes_clients') {
        const chain = mockChain({
          data: [{ id: 'lead-archived', nom: 'Marie', statut: 'archivé', assigne_a: agentUuid }],
          error: null,
          count: 1,
        });
        chain.eq = eq;
        return chain;
      }
      return mockChain({ data: [], error: null, count: 0 });
    });

    const res = await request(app)
      .get(`/api/leads?includeArchived=true&assignedTo=${agentUuid}`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith('assigne_a', agentUuid);
  });

  it('lists archived leads for agents scoped to self with date filters', async () => {
    const agentUuid = '00000000-0000-4000-8000-000000000002';
    mockGetUser.mockResolvedValue({
      data: { user: { id: agentUuid, email: 'agent@test.com' } },
      error: null,
    });
    const eq = vi.fn().mockReturnThis();
    const gte = vi.fn().mockReturnThis();
    const inFilter = vi.fn().mockReturnThis();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: agentUuid, nom: 'Agent', actif: true, role: 'agent' }, error: null });
      }
      if (table === 'demandes_clients') {
        const chain = mockChain({
          data: [{
            id: 'lead-archived',
            nom: 'Marie',
            statut: 'archivé',
            assigne_a: agentUuid,
            traitement_statut: 'réglé',
            last_agent_update_at: '2026-01-15T12:00:00.000Z',
          }],
          error: null,
          count: 1,
        });
        chain.eq = eq;
        chain.gte = gte;
        chain.in = inFilter;
        return chain;
      }
      if (table === 'logements') {
        return mockChain({ data: [], error: null });
      }
      return mockChain({ data: [], error: null, count: 0 });
    });

    const res = await request(app)
      .get('/api/leads?includeArchived=true&archivedFrom=2026-01-01&archivedTo=2026-01-31')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith('assigne_a', agentUuid);
    expect(inFilter).toHaveBeenCalledWith('traitement_statut', ['réglé', 'refusé']);
    expect(gte).toHaveBeenCalledWith('last_agent_update_at', expect.any(String));
    expect(res.body.data.items).toHaveLength(1);
  });

  it('rejects lead progress updates from non-assigned agents', async () => {
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
          data: {
            id: leadId,
            assigne_a: otherAgentUuid,
            statut: 'assigné',
            traitement_statut: 'contacté',
          },
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
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('finalizes lead progress with statut archivé and archived_at', async () => {
    const agentUuid = '00000000-0000-4000-8000-000000000002';
    const leadId = '00000000-0000-4000-8000-000000000099';
    mockGetUser.mockResolvedValue({
      data: { user: { id: agentUuid, email: 'agent@test.com' } },
      error: null,
    });

    let demandeQuery = 0;
    const update = vi.fn().mockReturnThis();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: agentUuid, nom: 'Agent', actif: true, role: 'agent' }, error: null });
      }
      if (table === 'demandes_clients') {
        demandeQuery += 1;
        if (demandeQuery === 1) {
          return mockChain({
            data: {
              id: leadId,
              assigne_a: agentUuid,
              statut: 'assigné',
              traitement_statut: 'contacté',
              archived_at: null,
            },
            error: null,
          });
        }
        const chain = mockChain({
          data: {
            id: leadId,
            assigne_a: agentUuid,
            statut: 'archivé',
            traitement_statut: 'réglé',
            archived_at: '2026-07-15T20:33:59.797Z',
            last_agent_update_at: '2026-07-15T20:33:59.797Z',
          },
          error: null,
        });
        chain.update = update;
        return chain;
      }
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .patch(`/api/leads/${leadId}/progress`)
      .set('Authorization', 'Bearer t')
      .send({ traitementStatut: 'réglé' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      traitement_statut: 'réglé',
      last_agent_update_at: expect.any(String),
      statut: 'archivé',
      archived_at: expect.any(String),
    });
    expect(res.body.data.statut).toBe('archivé');
    expect(res.body.data.traitement_statut).toBe('réglé');
  });

});
