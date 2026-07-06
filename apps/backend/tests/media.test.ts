import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authAs, mockChain } from './helpers/mockChain.js';

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

import { app } from '../src/app.js';

describe('media API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid mime on upload-url without auth', async () => {
    const res = await request(app)
      .post('/api/listings/00000000-0000-4000-8000-000000000001/media/upload-url')
      .send({ filename: 'x.exe', mimeType: 'application/octet-stream', sizeBytes: 100, type: 'image' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid mime with auth', async () => {
    authAs(mockGetUser, mockFrom, { id: 'u1', role: 'agent' });
    const res = await request(app)
      .post('/api/listings/00000000-0000-4000-8000-000000000001/media/upload-url')
      .set('Authorization', 'Bearer t')
      .send({ filename: 'x.exe', mimeType: 'application/octet-stream', sizeBytes: 100, type: 'image' });
    expect(res.status).toBe(400);
  });

  it('surfaces limit errors from reserve_listing_media_upload', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'image limit reached' } });
    authAs(mockGetUser, mockFrom, { id: 'u1', role: 'agent' });
    const res = await request(app)
      .post('/api/listings/00000000-0000-4000-8000-000000000001/media/upload-url')
      .set('Authorization', 'Bearer t')
      .send({ filename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, type: 'image' });
    expect(res.status).toBe(409);
  });

  it('creates pending media upload url for agent', async () => {
    mockRpc.mockResolvedValue({ data: 'media-1', error: null });
    authAs(mockGetUser, mockFrom, { id: 'u1', role: 'agent' });
    const res = await request(app)
      .post('/api/listings/00000000-0000-4000-8000-000000000001/media/upload-url')
      .set('Authorization', 'Bearer t')
      .send({ filename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, type: 'image' });
    expect(res.status).toBe(200);
    expect(res.body.data.mediaId).toBe('media-1');
    expect(mockRpc).toHaveBeenCalledWith('reserve_listing_media_upload', expect.any(Object));
  });

  it('returns approved media only on public listing detail', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'logements') {
        return mockChain({
          data: { id: 'l1', adresse: '123 Rue', statut: 'Available' },
          error: null,
        });
      }
      if (table === 'listing_media') {
        const chain = mockChain({
          data: [
            { id: 'm1', status: 'approved', type: 'image', upload_completed_at: '2026-01-01', object_key: 'k1', original_filename: 'a.jpg' },
          ],
          error: null,
        });
        return chain;
      }
      return mockChain({ data: [], error: null });
    });
    const res = await request(app).get('/api/public/listings/00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(200);
    expect(res.body.data.media[0].viewUrl).toContain('https://r2.example/view');
    expect(res.body.data.media[0].thumbnailUrl).toBeTruthy();
  });

  it('blocks public download for non-approved media', async () => {
    mockFrom.mockImplementation(() => mockChain({
      data: { id: 'm1', status: 'pending', object_key: 'k1', original_filename: 'a.jpg' },
      error: null,
    }));
    const res = await request(app).get('/api/listings/media/00000000-0000-4000-8000-000000000001/download-url');
    expect(res.status).toBe(403);
  });

  it('allows admin to approve pending media', async () => {
    authAs(mockGetUser, mockFrom, { id: 'admin-1', role: 'admin', nom: 'Admin' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agents') {
        return mockChain({ data: { id: 'admin-1', role: 'admin', actif: true, nom: 'Admin' }, error: null });
      }
      if (table === 'listing_media') {
        return mockChain({
          data: {
            id: 'm1',
            status: 'approved',
            original_filename: 'photo.jpg',
            listing_id: 'l1',
            agents: { email: 'agent@test.com', nom: 'Agent' },
          },
          error: null,
        });
      }
      if (table === 'logements') {
        return mockChain({ data: { adresse: '123 Rue Test' }, error: null });
      }
      return mockChain({ data: [], error: null });
    });
    const res = await request(app)
      .post('/api/listings/media/00000000-0000-4000-8000-000000000001/approve')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  it('rejects agent approving media', async () => {
    authAs(mockGetUser, mockFrom, { id: 'agent-1', role: 'agent' });
    const res = await request(app)
      .post('/api/listings/media/00000000-0000-4000-8000-000000000001/approve')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
  });
});
