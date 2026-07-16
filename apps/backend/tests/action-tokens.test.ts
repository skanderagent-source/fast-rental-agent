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

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null }) },
  })),
}));

import { app } from '../src/app.js';
import { consumeActionToken } from '../src/modules/auth/actionTokens.service.js';

const targetId = '00000000-0000-4000-8000-000000000001';

describe('one-time action tokens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('issues only a hashed, short-lived, user-bound token record', async () => {
    authAs(mockGetUser, mockFrom, { id: 'agent-1', role: 'agent' });
    let inserted: Record<string, unknown> | undefined;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'agent-1', actif: true, role: 'agent', nom: 'Agent' }, error: null });
      }
      const chain = mockChain({ data: null, error: null });
      if (table === 'security_action_tokens') {
        chain.insert = vi.fn((value: Record<string, unknown>) => {
          inserted = value;
          return chain;
        });
      }
      return chain;
    });

    const res = await request(app)
      .post('/api/me/action-token')
      .set('Authorization', 'Bearer fake-token')
      .send({ action: 'media.delete', targetId });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(inserted?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(inserted?.token_hash).not.toBe(res.body.data.token);
    expect(inserted).toMatchObject({
      user_id: 'agent-1',
      action: 'media.delete',
      target_id: targetId,
    });
  });

  it('rejects a targeted action without its target id', async () => {
    authAs(mockGetUser, mockFrom, { id: 'agent-1', role: 'agent' });
    const res = await request(app)
      .post('/api/me/action-token')
      .set('Authorization', 'Bearer fake-token')
      .send({ action: 'media.delete' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires a confirmation token before a destructive operation', async () => {
    authAs(mockGetUser, mockFrom, { id: 'agent-1', role: 'agent' });
    const res = await request(app)
      .delete(`/api/listings/media/${targetId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACTION_TOKEN_REQUIRED');
  });

  it('atomically consumes a matching token only once', async () => {
    const first = mockChain({ data: { token_hash: 'hash' }, error: null });
    const second = mockChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const token = 'a'.repeat(43);
    await expect(consumeActionToken(token, 'agent-1', 'media.delete', targetId)).resolves.toBe(true);
    await expect(consumeActionToken(token, 'agent-1', 'media.delete', targetId)).resolves.toBe(false);

    const firstHash = (first.eq as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstHash).not.toBe(token);
  });
});
