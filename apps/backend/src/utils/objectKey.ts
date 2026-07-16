const ALLOWED_OBJECT_KEY_PREFIXES = ['listings/', 'profiles/'] as const;

export function assertSafeObjectKey(objectKey: string): void {
  if (!objectKey || objectKey.length > 1024) {
    throw Object.assign(new Error('Clé objet invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (objectKey.includes('..') || /[\u0000-\u001f\u007f]/.test(objectKey)) {
    throw Object.assign(new Error('Clé objet invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (!ALLOWED_OBJECT_KEY_PREFIXES.some((prefix) => objectKey.startsWith(prefix))) {
    throw Object.assign(new Error('Clé objet invalide'), { status: 400, code: 'VALIDATION_ERROR' });
  }
}
