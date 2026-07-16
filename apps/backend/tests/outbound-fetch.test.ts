import { describe, expect, it } from 'vitest';
import {
  assertAllowlistedOutboundUrl,
  assertPublicOutboundHostname,
  geocodingAllowedOrigin,
} from '../src/utils/outboundFetch.js';

describe('outboundFetch', () => {
  it('allows public geocoding hostnames', () => {
    expect(() => assertPublicOutboundHostname('nominatim.openstreetmap.org')).not.toThrow();
    expect(geocodingAllowedOrigin()).toMatch(/^https:\/\/nominatim\.openstreetmap\.org$/);
  });

  it('blocks localhost and private IPv4 hostnames', () => {
    expect(() => assertPublicOutboundHostname('127.0.0.1')).toThrow(/blocked/i);
    expect(() => assertPublicOutboundHostname('10.0.0.5')).toThrow(/blocked/i);
    expect(() => assertPublicOutboundHostname('169.254.169.254')).toThrow(/blocked/i);
  });

  it('requires outbound URLs to match the configured allowlisted origin', () => {
    const allowedOrigin = geocodingAllowedOrigin();
    const allowedUrl = new URL(`${allowedOrigin}/search?q=test`);

    expect(() => assertAllowlistedOutboundUrl(allowedUrl, allowedOrigin)).not.toThrow();
    expect(() => assertAllowlistedOutboundUrl(new URL('https://evil.example/'), allowedOrigin)).toThrow(/not allowlisted/i);
  });
});
