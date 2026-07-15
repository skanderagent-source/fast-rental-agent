/** Listings with more approved media (photos + videos) appear first. */
export function sortListingsByMedia<T extends {
  approved_media_count?: number;
  approved_image_count?: number;
  adresse?: string;
}>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const mediaDiff = (b.approved_media_count ?? 0) - (a.approved_media_count ?? 0);
    if (mediaDiff !== 0) return mediaDiff;
    const imageDiff = (b.approved_image_count ?? 0) - (a.approved_image_count ?? 0);
    if (imageDiff !== 0) return imageDiff;
    return (a.adresse ?? '').localeCompare(b.adresse ?? '', 'fr');
  });
}

/** @deprecated Use sortListingsByMedia */
export const sortListingsByPhotos = sortListingsByMedia;
