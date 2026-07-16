import { MAX_IMAGE_PIXEL_DIMENSION } from '@fast-rental/shared';

const JPEG_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function detectedMimeFromMagic(buffer: Buffer): string | null {
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand.startsWith('qt')) return 'video/quicktime';
    return 'video/mp4';
  }
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  return null;
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    if (JPEG_MARKERS.has(marker) && offset + 7 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X' && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (chunkType === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >> 14) & 0x3fff);
    return { width, height };
  }
  return null;
}

function readImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  if (mimeType === 'image/png') return readPngDimensions(buffer);
  if (mimeType === 'image/jpeg') return readJpegDimensions(buffer);
  if (mimeType === 'image/webp') return readWebpDimensions(buffer);
  return null;
}

function dimensionsWithinLimit(width: number, height: number): boolean {
  return (
    Number.isFinite(width)
    && Number.isFinite(height)
    && width > 0
    && height > 0
    && width <= MAX_IMAGE_PIXEL_DIMENSION
    && height <= MAX_IMAGE_PIXEL_DIMENSION
  );
}

export function validateMediaContentBuffer(
  buffer: Buffer,
  declaredMimeType: string,
  declaredSizeBytes: number,
): string | null {
  if (buffer.length === 0) return 'Fichier vide';
  if (buffer.length > declaredSizeBytes) return 'Fichier plus grand que la taille déclarée';

  const detectedMime = detectedMimeFromMagic(buffer);
  if (!detectedMime) return 'Type de fichier non reconnu';
  if (detectedMime !== declaredMimeType) return 'Le contenu ne correspond pas au type MIME déclaré';

  if (declaredMimeType.startsWith('image/')) {
    const dimensions = readImageDimensions(buffer, declaredMimeType);
    if (!dimensions) return 'Impossible de lire les dimensions de l’image';
    if (!dimensionsWithinLimit(dimensions.width, dimensions.height)) {
      return `Image trop grande (max ${MAX_IMAGE_PIXEL_DIMENSION}px par côté)`;
    }
  }

  return null;
}

export function validateMediaContentSize(actualSizeBytes: number, declaredSizeBytes: number): string | null {
  if (actualSizeBytes <= 0) return 'Fichier vide';
  if (actualSizeBytes > declaredSizeBytes) return 'Fichier plus grand que la taille déclarée';
  return null;
}
