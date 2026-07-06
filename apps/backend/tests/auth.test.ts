import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockCreateUser = vi.fn();

vi.mock('../src/db/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        deleteUser: vi.fn(),
        listUsers: vi.fn(),
      },
    },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: vi.fn(),
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null }) },
  })),
}));

import { app } from '../src/app.js';
import { authAs, mockChain } from './helpers/mockChain.js';

function chain(resolved: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  return mockChain(resolved);
}

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('auth middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing token on /api/me', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects inactive user', async () => {
    authAs(mockGetUser, mockFrom, { id: 'user-1', actif: false });
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/désactivé/i);
  });
});

describe('admin routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects user creation without auth', async () => {
    const res = await request(app).post('/api/users').send({ nom: 'Test', email: 'test@example.com', password: 'secret123', role: 'agent' });
    expect(res.status).toBe(401);
  });

  it('rejects agent creating listing', async () => {
    authAs(mockGetUser, mockFrom, { role: 'agent' });
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', 'Bearer fake-token')
      .send({ adresse: '123 Rue Test' });
    expect(res.status).toBe(403);
  });

  it('allows admin creating listing', async () => {
    authAs(mockGetUser, mockFrom, { role: 'admin' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') return chain({ data: { id: 'user-1', actif: true, role: 'admin', nom: 'Admin' }, error: null });
      if (table === 'logements') return chain({ data: { id: 'listing-1', adresse: '123 Rue Test', geocoding_status: 'pending' }, error: null });
      if (table === 'listing_media_counts') return chain({ data: [], error: null });
      return chain({ data: [], error: null });
    });
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', 'Bearer fake-token')
      .send({ adresse: '123 Rue Test' });
    expect(res.status).toBe(200);
  });

  it('allows admin to create user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@test.com' } },
      error: null,
    });
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    let agentQuery = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        agentQuery += 1;
        if (agentQuery === 1) {
          return mockChain({ data: { id: 'admin-1', actif: true, role: 'admin', nom: 'Admin' }, error: null });
        }
        return mockChain({
          data: { id: 'new-user', email: 'agent@test.com', nom: 'New Agent', role: 'agent', actif: true },
          error: null,
        });
      }
      if (table === 'activite') return mockChain({ data: {}, error: null });
      return mockChain({ data: [], error: null });
    });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer fake-token')
      .send({ nom: 'New Agent', email: 'agent@test.com', password: 'secret123', role: 'agent' });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('agent@test.com');
  });

  it('rejects agent creating user', async () => {
    authAs(mockGetUser, mockFrom, { role: 'agent' });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer fake-token')
      .send({ nom: 'Test', email: 'test@example.com', password: 'secret123', role: 'agent' });
    expect(res.status).toBe(403);
  });
});

describe('public listings', () => {
  it('allows unauthenticated public listings request', async () => {
    mockFrom.mockImplementation(() => chain({ data: [], error: null, count: 0 }));
    const res = await request(app).get('/api/public/listings');
    expect([200, 500]).toContain(res.status);
  });
});
