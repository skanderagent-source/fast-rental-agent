import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockChain } from './helpers/mockChain.js';

const mockFrom = vi.fn();

vi.mock('../src/db/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
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

  it('rejects unauthenticated listing create', async () => {
    const res = await request(app).post('/api/listings').send({ adresse: 'Test' });
    expect(res.status).toBe(401);
  });
});
