import { useCallback, useState } from 'react';
import { assertOnline } from './onlineStatus';

export class OfflineError extends Error {
  constructor(message = 'Connexion indisponible. Réessayez lorsque vous êtes en ligne.') {
    super(message);
    this.name = 'OfflineError';
  }
}

type SubmitLockOptions = {
  requireOnline?: boolean;
};

export function useSubmitLock(options: SubmitLockOptions = {}) {
  const [locked, setLocked] = useState(false);
  const { requireOnline = false } = options;

  const run = useCallback(async (action: () => Promise<void>) => {
    if (locked) return;
    if (requireOnline) {
      try {
        assertOnline();
      } catch (err) {
        throw err instanceof OfflineError ? err : new OfflineError();
      }
    }
    setLocked(true);
    try {
      await action();
    } finally {
      setLocked(false);
    }
  }, [locked, requireOnline]);

  return { locked, run };
}
