import { describe, expect, it, vi } from 'vitest';
import {
  canUseClipboardWrite,
  clearScheduledClipboardClears,
  copyTextToClipboard,
} from '../../frontend/src/lib/clipboard.js';

describe('frontend clipboard hardening', () => {
  it('checks clipboard-write permission when supported', async () => {
    const query = vi.fn().mockResolvedValue({ state: 'granted' });
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn() },
      permissions: { query },
    });
    vi.stubGlobal('window', { isSecureContext: true });

    await expect(canUseClipboardWrite()).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith({ name: 'clipboard-write' });
  });

  it('copies text and schedules sensitive clipboard clearing', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    });
    vi.stubGlobal('window', { isSecureContext: true });

    await copyTextToClipboard('secret-code', { sensitive: true, clearAfterMs: 1000 });
    expect(writeText).toHaveBeenCalledWith('secret-code');

    await vi.advanceTimersByTimeAsync(1000);
    expect(writeText).toHaveBeenCalledWith('');

    clearScheduledClipboardClears();
    vi.useRealTimers();
  });
});
