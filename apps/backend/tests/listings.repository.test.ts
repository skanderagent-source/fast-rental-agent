import { describe, expect, it } from 'vitest';
import { sortListingsByPhotos } from '../src/modules/listings/listings.repository.js';

describe('sortListingsByPhotos', () => {
  it('sorts listings with more approved photos first', () => {
    const sorted = sortListingsByPhotos([
      { id: '1', adresse: 'B Rue', approved_image_count: 0 },
      { id: '2', adresse: 'A Rue', approved_image_count: 3 },
      { id: '3', adresse: 'C Rue', approved_image_count: 1 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['2', '3', '1']);
  });

  it('breaks ties by address alphabetically', () => {
    const sorted = sortListingsByPhotos([
      { id: '1', adresse: 'Zebra', approved_image_count: 2 },
      { id: '2', adresse: 'Alpha', approved_image_count: 2 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['2', '1']);
  });
});
