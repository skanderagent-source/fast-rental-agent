import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('HTTP request boundary', () => {
  it('blocks non-essential raw HTTP methods', async () => {
    const res = await request(app).trace('/api/me');
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('returns 405 with Allow for unsupported methods on known routes', async () => {
    const res = await request(app).put('/api/me');
    expect(res.status).toBe(405);
    expect(res.headers.allow).toContain('GET');
    expect(res.headers.allow).toContain('PATCH');
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects non-canonical encoded paths', async () => {
    const res = await request(app).get('/api/listings%2Fmap');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AMBIGUOUS_PATH');
  });

  it('validates the Host header against production configuration', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app)
      .get('/health')
      .set('Host', 'attacker-controlled.example')
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_HOST');
  });
});

describe('preflight policy', () => {
  it('rejects preflights for unknown API routes', async () => {
    const res = await request(app)
      .options('/api/not-a-route')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(404);
  });

  it('rejects a preflight method not supported by the route', async () => {
    const res = await request(app)
      .options('/api/me')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(405);
  });

  it('rejects unapproved preflight headers', async () => {
    const res = await request(app)
      .options('/api/me')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,x-unapproved');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PREFLIGHT');
  });
});

describe('input and body limits', () => {
  it('rejects duplicate query parameters', async () => {
    const res = await request(app).get('/api/public/listings?page=1&page=2');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DUPLICATE_QUERY_PARAMETER');
  });

  it('rejects prototype-polluting object keys', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"polluted":true}}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DANGEROUS_OBJECT_KEY');
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects malformed UUID route parameters before database access', async () => {
    const res = await request(app).get('/api/public/listings/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  it('rejects unknown query parameters on validated public routes', async () => {
    const res = await request(app).get('/api/public/listings?unexpected=value');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects compressed request bodies before parsing', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('{"nom":"Test"}');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('enforces the JSON body limit', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send({ payload: 'x'.repeat(2 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it('enforces URL-encoded and text body limits', async () => {
    const oversized = 'x'.repeat(70 * 1024);
    const [form, text] = await Promise.all([
      request(app)
        .post('/api/users')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(`payload=${oversized}`),
      request(app)
        .post('/api/users')
        .set('Content-Type', 'text/plain')
        .send(oversized),
    ]);
    expect(form.status).toBe(413);
    expect(text.status).toBe(413);
  });
});
