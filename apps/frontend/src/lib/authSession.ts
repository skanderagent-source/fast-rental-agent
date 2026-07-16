import type { QueryClient } from '@tanstack/react-query';
import { clearScheduledClipboardClears } from './clipboard';
import { revokeTrackedObjectUrls } from './media';

let abortController = new AbortController();

export function getApiAbortSignal(): AbortSignal {
  return abortController.signal;
}

export function abortInFlightApiRequests(): void {
  abortController.abort();
  abortController = new AbortController();
}

async function clearServiceWorkerCaches(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.getRegistrations) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Best-effort cleanup for future SW adoption.
  }
}

export function clearClientSession(queryClient: QueryClient): void {
  queryClient.cancelQueries();
  queryClient.clear();
  abortInFlightApiRequests();
  clearScheduledClipboardClears();
  revokeTrackedObjectUrls();
  void clearServiceWorkerCaches();
}
