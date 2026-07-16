export function secureRandomId(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Secure random generation is unavailable in this browser');
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
