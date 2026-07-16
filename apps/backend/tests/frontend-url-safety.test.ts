import { describe, expect, it } from 'vitest';
import {
  isSafeExternalUrl,
  isSafeHttpUrl,
  isSafeInternalPath,
  isSafeMediaUrl,
} from '../../frontend/src/lib/urlSafetyCore.js';

const devCtx = {
  production: false,
  apiOrigin: 'http://localhost:4000',
};

describe('frontend url safety', () => {
  it('rejects javascript and file schemes', () => {
    expect(isSafeHttpUrl('javascript:alert(1)', devCtx)).toBe(false);
    expect(isSafeHttpUrl('file:///etc/passwd', devCtx)).toBe(false);
    expect(isSafeMediaUrl('vbscript:run', devCtx)).toBe(false);
  });

  it('allows https service URLs for media and downloads', () => {
    expect(isSafeMediaUrl('https://acct.r2.cloudflarestorage.com/bucket/key?sig=1', devCtx)).toBe(true);
    expect(isSafeExternalUrl('https://acct.r2.cloudflarestorage.com/bucket/key?sig=1', devCtx)).toBe(true);
  });

  it('allows local API storage URLs in development', () => {
    const url = 'http://localhost:4000/api/storage/object?key=listings%2Fx%2Fy';
    expect(isSafeMediaUrl(url, devCtx)).toBe(true);
    expect(isSafeExternalUrl(url, devCtx)).toBe(true);
  });

  it('blocks open redirects in internal navigation paths', () => {
    expect(isSafeInternalPath('/app/search')).toBe(true);
    expect(isSafeInternalPath('//evil.example')).toBe(false);
    expect(isSafeInternalPath('https://evil.example')).toBe(false);
  });
});
