import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_PIXEL_DIMENSION } from '@fast-rental/shared';
import { validateMediaContentBuffer } from '../src/utils/mediaContentInspection.js';
import { assertSafeObjectKey } from '../src/utils/objectKey.js';

function pngBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegBuffer(width: number, height: number): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0xff, 0xd9,
  ]);
}

describe('mediaContentInspection', () => {
  it('accepts JPEG content matching the declared MIME type', () => {
    const buffer = jpegBuffer(800, 600);
    expect(validateMediaContentBuffer(buffer, 'image/jpeg', buffer.length)).toBeNull();
  });

  it('accepts PNG content matching the declared MIME type', () => {
    const buffer = pngBuffer(640, 480);
    expect(validateMediaContentBuffer(buffer, 'image/png', buffer.length)).toBeNull();
  });

  it('rejects MIME/content mismatches', () => {
    const buffer = jpegBuffer(100, 100);
    expect(validateMediaContentBuffer(buffer, 'image/png', buffer.length)).toMatch(/ne correspond pas/i);
  });

  it('rejects oversized image dimensions', () => {
    const buffer = pngBuffer(MAX_IMAGE_PIXEL_DIMENSION + 1, 100);
    expect(validateMediaContentBuffer(buffer, 'image/png', buffer.length)).toMatch(/Image trop grande/i);
  });
});

describe('objectKey safety', () => {
  it('accepts listing and profile prefixes', () => {
    expect(() => assertSafeObjectKey('listings/uuid/file.jpg')).not.toThrow();
    expect(() => assertSafeObjectKey('profiles/uuid/file.jpg')).not.toThrow();
  });

  it('rejects traversal and unknown prefixes', () => {
    expect(() => assertSafeObjectKey('listings/../etc/passwd')).toThrow(/invalide/i);
    expect(() => assertSafeObjectKey('public/evil.jpg')).toThrow(/invalide/i);
  });
});
