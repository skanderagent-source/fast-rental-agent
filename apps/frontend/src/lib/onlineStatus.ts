import { useSyncExternalStore } from 'react';

export const OFFLINE_MESSAGE = 'Connexion indisponible. Réessayez lorsque vous êtes en ligne.';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function assertOnline(): void {
  if (!isOnline()) {
    throw new Error(OFFLINE_MESSAGE);
  }
}
