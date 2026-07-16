import { describe, expect, it } from 'vitest';
import {
  sanitizeFilenameForDisplay,
  sanitizeFilenameForUpload,
  sniffMediaMime,
} from '../../frontend/src/lib/mediaUpload.js';

function makeFile(bytes: number[], name: string, type = ''): File {
  return new File([Uint8Array.from(bytes)], name, { type });
}

describe('frontend media upload validation', () => {
  it('sanitizes misleading filenames for display and upload', () => {
    expect(sanitizeFilenameForDisplay('../../etc/passwd')).toBe('....etcpasswd');
    expect(sanitizeFilenameForDisplay('photo\x00hidden.jpg')).toBe('photohidden.jpg');
    expect(sanitizeFilenameForUpload('My Photo (1).jpg')).toBe('My Photo (1).jpg');
  });

  it('sniffs supported image formats from file headers', async () => {
    const jpeg = makeFile([0xff, 0xd8, 0xff, 0xe0], 'photo.jpg', 'image/jpeg');
    const png = makeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'photo.png', 'image/png');
    const webp = makeFile([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ], 'photo.webp', 'image/webp');

    await expect(sniffMediaMime('image', jpeg)).resolves.toBe('image/jpeg');
    await expect(sniffMediaMime('image', png)).resolves.toBe('image/png');
    await expect(sniffMediaMime('image', webp)).resolves.toBe('image/webp');
  });

  it('sniffs supported video formats from file headers', async () => {
    const mp4 = makeFile([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6f, 0x6d,
    ], 'clip.mp4', 'video/mp4');
    const webm = makeFile([0x1a, 0x45, 0xdf, 0xa3], 'clip.webm', 'video/webm');

    await expect(sniffMediaMime('video', mp4)).resolves.toBe('video/mp4');
    await expect(sniffMediaMime('video', webm)).resolves.toBe('video/webm');
  });

  it('rejects unknown binary payloads', async () => {
    const unknown = makeFile([0x00, 0x01, 0x02, 0x03], 'bad.bin', 'application/octet-stream');
    await expect(sniffMediaMime('image', unknown)).resolves.toBeNull();
    await expect(sniffMediaMime('video', unknown)).resolves.toBeNull();
  });
});
