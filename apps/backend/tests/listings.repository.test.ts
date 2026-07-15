import { describe, expect, it } from 'vitest';
import { sortListingsByMedia } from '../src/modules/listings/listings.repository.js';

describe('sortListingsByMedia', () => {
  it('sorts listings with more approved media first', () => {
    const sorted = sortListingsByMedia([
      { id: '1', adresse: 'B Rue', approved_media_count: 0, approved_image_count: 0 },
      { id: '2', adresse: 'A Rue', approved_media_count: 3, approved_image_count: 2 },
      { id: '3', adresse: 'C Rue', approved_media_count: 1, approved_image_count: 0 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['2', '3', '1']);
  });

  it('ranks video-only listings above listings without media', () => {
    const sorted = sortListingsByMedia([
      { id: '1', adresse: 'A Rue', approved_media_count: 0, approved_image_count: 0 },
      { id: '2', adresse: 'B Rue', approved_media_count: 1, approved_image_count: 0 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['2', '1']);
  });

  it('breaks ties by address alphabetically', () => {
    const sorted = sortListingsByMedia([
      { id: '1', adresse: 'Zebra', approved_media_count: 2, approved_image_count: 2 },
      { id: '2', adresse: 'Alpha', approved_media_count: 2, approved_image_count: 2 },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['2', '1']);
  });
});
