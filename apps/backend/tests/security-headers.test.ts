import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('security headers', () => {
  it('sets the API header policy and hides Express technology disclosure', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(app.get('json escape')).toBe(true);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });

  it('redirects HTTP to HTTPS in production', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(app)
      .get('/health?source=test')
      .set('Host', 'localhost:4000')
      .set('X-Forwarded-Proto', 'http');

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://localhost:4000/health?source=test');
  });
});

describe('private API cache policy', () => {
  it('prevents caching of authenticated API responses', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer test');

    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
    expect(res.headers.pragma).toBe('no-cache');
    expect(res.headers.expires).toBe('0');
  });

  it('does not add private cache headers to public listing endpoints', async () => {
    const res = await request(app).get('/api/public/listings');

    expect(res.headers['cache-control']).toBeUndefined();
    expect(res.headers.pragma).toBeUndefined();
  });
});

describe('CORS policy', () => {
  it('allows the configured exact origin without credentialed CORS', async () => {
    const res = await request(app)
      .options('/api/me')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE,OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Authorization,Content-Type,X-Action-Token');
  });

  it('does not grant CORS access to an unlisted origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not compress authenticated private API payloads', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Accept-Encoding', 'gzip, deflate');

    expect(res.headers['content-encoding']).toBeUndefined();
  });
});
