const trackedObjectUrls = new Set<string>();

export function trackObjectUrl(url: string): string {
  trackedObjectUrls.add(url);
  return url;
}

export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
  trackedObjectUrls.delete(url);
}

export function revokeTrackedObjectUrls(): void {
  for (const url of trackedObjectUrls) {
    URL.revokeObjectURL(url);
  }
  trackedObjectUrls.clear();
}

export function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = trackObjectUrl(URL.createObjectURL(file));
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      revokeObjectUrl(url);
      resolve(video.duration);
    };

    video.onerror = () => {
      revokeObjectUrl(url);
      reject(new Error('Impossible de lire la durée de la vidéo'));
    };

    video.src = url;
  });
}
