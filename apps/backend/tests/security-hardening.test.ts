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

import { app } from '../src/app.js';

describe('security hardening', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects weak admin-created passwords', async () => {
    authAs(mockGetUser, mockFrom, { role: 'admin' });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer fake-token')
      .send({
        nom: 'Test',
        email: 'test@example.com',
        password: 'short1',
        role: 'agent',
      });
    expect(res.status).toBe(400);
  });

  it('rejects invalid admin test email recipient', async () => {
    authAs(mockGetUser, mockFrom, { role: 'admin', email: 'admin@example.com' });
    const res = await request(app)
      .post('/api/admin/email/test')
      .set('Authorization', 'Bearer fake-token')
      .send({ to: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects mass-assignment fields outside the listing DTO', async () => {
    authAs(mockGetUser, mockFrom, { role: 'admin' });
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', 'Bearer fake-token')
      .send({
        adresse: '123 Rue sûre',
        created_by: 'attacker-controlled-id',
        deleted_at: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires application/json on JSON API bodies', async () => {
    authAs(mockGetUser, mockFrom, { role: 'admin' });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer fake-token')
      .set('Content-Type', 'text/plain')
      .send('{"nom":"Test","email":"test@example.com","password":"Secret12345","role":"agent"}');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects top-level JSON primitives', async () => {
    authAs(mockGetUser, mockFrom, { role: 'admin' });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer fake-token')
      .set('Content-Type', 'application/json')
      .send('"not-an-object"');
    expect(res.status).toBe(400);
  });

  it('sanitizes listing search before querying', async () => {
    const listingChain = mockChain({ data: [], error: null, count: 0 });
    authAs(mockGetUser, mockFrom, { role: 'agent' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'user-1', actif: true, role: 'agent', nom: 'Agent' }, error: null });
      }
      if (table === 'logements') return listingChain;
      if (table === 'listing_media_counts') return mockChain({ data: [], error: null });
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .get('/api/listings')
      .query({ q: 'foo,statut.eq.Available' })
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(listingChain.or).toHaveBeenCalledWith('adresse.ilike.%foo statut eq Available%,quartier.ilike.%foo statut eq Available%');
  });

  it('rejects listing searches shorter than two characters', async () => {
    authAs(mockGetUser, mockFrom, { role: 'agent' });
    const res = await request(app)
      .get('/api/listings')
      .query({ q: 'a' })
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
