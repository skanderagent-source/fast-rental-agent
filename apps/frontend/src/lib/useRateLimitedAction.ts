import { useCallback, useEffect, useState } from 'react';

function readCooldownUntil(storageKey: string): number {
  const raw = sessionStorage.getItem(storageKey);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useRateLimitedAction(storageKey: string, cooldownMs: number) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    function tick() {
      const until = readCooldownUntil(storageKey);
      const next = Math.max(0, until - Date.now());
      setRemainingMs(next);
    }
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [storageKey]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (Date.now() < readCooldownUntil(storageKey)) return false;
    sessionStorage.setItem(storageKey, String(Date.now() + cooldownMs));
    setRemainingMs(cooldownMs);
    await action();
    return true;
  }, [cooldownMs, storageKey]);

  return {
    remainingMs,
    blocked: remainingMs > 0,
    run,
  };
}
