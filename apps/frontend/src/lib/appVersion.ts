const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? 'dev';
const STORAGE_KEY = 'fast-rental-build-id';

export function enforceCurrentAppBuild() {
  if (import.meta.env.DEV) return;

  const previous = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.setItem(STORAGE_KEY, BUILD_ID);

  if (previous && previous !== BUILD_ID) {
    window.location.reload();
  }
}
