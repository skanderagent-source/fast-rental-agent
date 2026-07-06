/** Photos-first sort used before pagination (plan requirement). */
export function sortListingsByPhotos<T extends { approved_image_count?: number; adresse?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const imgDiff = (b.approved_image_count ?? 0) - (a.approved_image_count ?? 0);
    if (imgDiff !== 0) return imgDiff;
    return (a.adresse ?? '').localeCompare(b.adresse ?? '', 'fr');
  });
}
