import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  validateMediaMime,
} from '@fast-rental/shared';

const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;
const PATH_SEPARATORS = /[/\\]/g;

export function sanitizeFilenameForDisplay(name: string): string {
  const base = name.replace(PATH_SEPARATORS, '').replace(CONTROL_CHARS, '').trim();
  return base.slice(0, 120) || 'fichier';
}

export function sanitizeFilenameForUpload(name: string): string {
  const base = sanitizeFilenameForDisplay(name);
  return base.replace(/[^\w.\-() ]+/g, '_');
}

async function readFileHeader(file: File, length = 16): Promise<Uint8Array> {
  const buffer = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buffer);
}

function bytesMatch(header: Uint8Array, pattern: number[], offset = 0): boolean {
  return pattern.every((byte, index) => header[offset + index] === byte);
}

function bytesToAscii(header: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...header.slice(start, start + length));
}

export async function sniffMediaMime(type: 'image' | 'video', file: File): Promise<string | null> {
  const header = await readFileHeader(file, 16);

  if (type === 'image') {
    if (bytesMatch(header, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (bytesMatch(header, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
    if (
      bytesMatch(header, [0x52, 0x49, 0x46, 0x46])
      && header.length >= 12
      && bytesToAscii(header, 8, 4) === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }

  if (header.length >= 12 && bytesToAscii(header, 4, 4) === 'ftyp') {
    const brand = bytesToAscii(header, 8, 4);
    if (brand === 'qt  ' || brand.startsWith('qt')) return 'video/quicktime';
    return 'video/mp4';
  }
  if (bytesMatch(header, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  return null;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire l’image'));
    };
    image.src = url;
  });
}

export async function stripImageExif(file: File, mimeType: string): Promise<File> {
  if (!IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number])) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context || canvas.width <= 0 || canvas.height <= 0) return file;

    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, 0.92);
    });
    if (!blob) return file;

    return new File([blob], file.name, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export type MediaUploadValidationResult =
  | { ok: true; file: File; mimeType: string; filename: string }
  | { ok: false; error: string };

export async function validateMediaFileForUpload(
  type: 'image' | 'video',
  file: File,
): Promise<MediaUploadValidationResult> {
  const sniffedMime = await sniffMediaMime(type, file);
  if (!sniffedMime) {
    return { ok: false, error: type === 'image' ? 'Format d’image non reconnu' : 'Format de vidéo non reconnu' };
  }

  if (type === 'image') {
    if (!IMAGE_MIME_TYPES.includes(sniffedMime as (typeof IMAGE_MIME_TYPES)[number])) {
      return { ok: false, error: 'Type d’image non autorisé' };
    }
  } else if (!VIDEO_MIME_TYPES.includes(sniffedMime as (typeof VIDEO_MIME_TYPES)[number])) {
    return { ok: false, error: 'Type de vidéo non autorisé' };
  }

  if (file.type && file.type !== sniffedMime) {
    return { ok: false, error: 'Le type du fichier ne correspond pas à son contenu' };
  }

  const mimeError = validateMediaMime(type, sniffedMime, file.size);
  if (mimeError) {
    return { ok: false, error: mimeError };
  }

  let uploadFile = file;
  if (type === 'image') {
    uploadFile = await stripImageExif(file, sniffedMime);
  }

  return {
    ok: true,
    file: uploadFile,
    mimeType: sniffedMime,
    filename: sanitizeFilenameForUpload(file.name),
  };
}
