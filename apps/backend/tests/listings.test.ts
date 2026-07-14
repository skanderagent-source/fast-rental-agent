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

describe('listings API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns public listings', async () => {
    mockFrom.mockImplementation(() => mockChain({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/api/public/listings');
    expect(res.status).toBe(200);
  });

  it('retrieves map listings in backend pages', async () => {
    const firstPageRows = Array.from({ length: 1000 }, (_, index) => ({
      id: `listing-${index}`,
      adresse: `Adresse ${index}`,
      quartier: 'Rosemont',
      prix: 1200,
      statut: 'Available',
      latitude: 45.5,
      longitude: -73.5,
    }));
    const secondPageRows = Array.from({ length: 500 }, (_, index) => ({
      id: `listing-${index + 1000}`,
      adresse: `Adresse ${index + 1000}`,
      quartier: 'Rosemont',
      prix: 1200,
      statut: 'Available',
      latitude: 45.5,
      longitude: -73.5,
    }));
    const firstPageChain = mockChain({ data: firstPageRows, error: null, count: 1500 });
    const secondPageChain = mockChain({ data: secondPageRows, error: null });
    let logementCalls = 0;

    authAs(mockGetUser, mockFrom, { id: 'user-1', role: 'agent' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'user-1', actif: true, role: 'agent', nom: 'Agent' }, error: null });
      }
      if (table === 'logements') {
        return [firstPageChain, secondPageChain][logementCalls++]!;
      }
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .get('/api/listings/map')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1500, truncated: false });
    expect(res.body.data.items).toHaveLength(1500);
    expect(firstPageChain.range).toHaveBeenCalledWith(0, 999);
    expect(secondPageChain.range).toHaveBeenCalledWith(1000, 1499);
  });

  it('returns the authenticated user media without listing fan-out', async () => {
    authAs(mockGetUser, mockFrom, { id: 'user-1', role: 'agent' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'user-1', actif: true, role: 'agent', nom: 'Agent' }, error: null });
      }
      if (table === 'listing_media') {
        return mockChain({ data: [], error: null });
      }
      return mockChain({ data: [], error: null });
    });

    const res = await request(app)
      .get('/api/listings/me/media')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('logements');
  });

  it('rejects unauthenticated listing create', async () => {
    const res = await request(app).post('/api/listings').send({ adresse: 'Test' });
    expect(res.status).toBe(401);
  });
});
