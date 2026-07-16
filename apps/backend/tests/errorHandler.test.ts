import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { HttpError } from '../src/utils/httpErrors.js';

function mockResponse() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('errorHandler', () => {
  it('returns generic message for 500 errors', () => {
    const res = mockResponse();
    errorHandler(new Error('relation "secret_table" does not exist'), {} as never, res as never, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' },
    });
  });

  it('returns safe client message for HttpError 4xx', () => {
    const res = mockResponse();
    errorHandler(new HttpError(403, 'FORBIDDEN', 'Accès refusé'), {} as never, res as never, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Accès refusé' },
    });
  });

  it('hides unexpected 4xx internals in production', () => {
    const res = mockResponse();
    errorHandler(
      new Error('relation "secret_table" does not exist at /var/lib/postgres/main.sql'),
      {} as never,
      res as never,
      () => {},
    );
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' },
    });
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });
});
