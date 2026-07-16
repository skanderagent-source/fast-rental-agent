export type CopyToClipboardOptions = {
  /** Clears clipboard after a short delay to reduce accidental leakage. */
  sensitive?: boolean;
  clearAfterMs?: number;
};

const DEFAULT_SENSITIVE_CLEAR_MS = 30_000;
const clearTimers = new Set<ReturnType<typeof setTimeout>>();

export function clearScheduledClipboardClears(): void {
  for (const timer of clearTimers) {
    clearTimeout(timer);
  }
  clearTimers.clear();
}

export async function canUseClipboardWrite(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!window.isSecureContext) return typeof document !== 'undefined' && !!document.queryCommandSupported?.('copy');

  const clipboard = navigator.clipboard;
  if (!clipboard?.writeText) {
    return typeof document !== 'undefined' && !!document.queryCommandSupported?.('copy');
  }

  if (!navigator.permissions?.query) return true;

  try {
    const status = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
    return status.state !== 'denied';
  } catch {
    return true;
  }
}

async function writeWithFallback(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === 'undefined') {
    throw new Error('copy unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy failed');
}

function scheduleClipboardClear(delayMs: number): void {
  const timer = setTimeout(() => {
    clearTimers.delete(timer);
    void (async () => {
      try {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
          await navigator.clipboard.writeText('');
        }
      } catch {
        // Best-effort only; some browsers block programmatic clipboard clearing.
      }
    })();
  }, delayMs);
  clearTimers.add(timer);
}

export async function copyTextToClipboard(
  text: string,
  options: CopyToClipboardOptions = {},
): Promise<void> {
  const allowed = await canUseClipboardWrite();
  if (!allowed) {
    throw new Error('clipboard permission denied');
  }

  await writeWithFallback(text);

  if (options.sensitive) {
    scheduleClipboardClear(options.clearAfterMs ?? DEFAULT_SENSITIVE_CLEAR_MS);
  }
}
