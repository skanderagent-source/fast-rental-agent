const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
]);

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  return false;
}

export function assertPublicOutboundHostname(hostname: string): void {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized) throw new Error('Outbound hostname is required');
  if (BLOCKED_HOSTNAMES.has(normalized)) throw new Error(`Outbound hostname blocked: ${normalized}`);
  if (normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    throw new Error(`Outbound hostname blocked: ${normalized}`);
  }
  if (isBlockedIpv4(normalized) || isBlockedIpv6(normalized)) {
    throw new Error(`Outbound hostname blocked: ${normalized}`);
  }
}
