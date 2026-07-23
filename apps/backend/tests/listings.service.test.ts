import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockChain } from './helpers/mockChain.js';

const mockFrom = vi.fn();
const mockGeocodeListing = vi.fn();
const mockCreateDownloadUrl = vi.fn();

vi.mock('../src/db/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../src/modules/listings/listings.geocode.js', () => ({
  geocodeListing: (...args: unknown[]) => mockGeocodeListing(...args),
}));

vi.mock('../src/modules/media/storage.service.js', () => ({
  createDownloadUrl: (...args: unknown[]) => mockCreateDownloadUrl(...args),
  createUploadUrl: vi.fn(),
  deleteObject: vi.fn(),
  isLocalStorage: vi.fn(() => false),
  objectExists: vi.fn(),
  putObject: vi.fn(),
  readObjectPrefix: vi.fn(),
  readObjectSize: vi.fn(),
}));

import { deleteObject } from '../src/modules/media/storage.service.js';
import { listUserMedia, softDeleteListing, updateListing } from '../src/modules/listings/listings.service.js';

const existingListing = {
  id: 'listing-1',
  adresse: '123 Rue Ancienne',
  quartier: 'Rosemont',
  ville: 'Montréal',
  latitude: 45.54,
  longitude: -73.58,
  geocoding_status: 'success',
  geocoding_error: null,
  geocoded_at: '2026-07-01T00:00:00.000Z',
  manual_overrides: {},
};

function mockUpdate(existing = existingListing) {
  const readChain = mockChain({ data: existing, error: null });
  const writeChain = mockChain({ data: { ...existing }, error: null });
  let calls = 0;
  mockFrom.mockImplementation(() => [readChain, writeChain][calls++]!);
  return { writeChain };
}

describe('updateListing geocoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeocodeListing.mockResolvedValue('success');
    mockCreateDownloadUrl.mockResolvedValue('https://media.example/photo.jpg');
  });

  it('keeps the last known coordinates while re-geocoding an address change', async () => {
    const { writeChain } = mockUpdate();

    await updateListing(existingListing.id, { adresse: '456 Rue Nouvelle' });

    expect(writeChain.update).toHaveBeenCalledWith(expect.objectContaining({
      geocoded_at: null,
      geocoding_status: 'pending',
      geocoding_error: null,
    }));
    const updates = writeChain.update.mock.calls[0]?.[0];
    expect(updates).not.toHaveProperty('latitude');
    expect(updates).not.toHaveProperty('longitude');
    expect(mockGeocodeListing).toHaveBeenCalledWith(existingListing.id);
  });

  it('keeps explicitly changed coordinate pairs as manual coordinates', async () => {
    const { writeChain } = mockUpdate();

    await updateListing(existingListing.id, {
      adresse: '456 Rue Nouvelle',
      latitude: 45.5,
      longitude: -73.6,
    });

    expect(writeChain.update).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 45.5,
      longitude: -73.6,
      geocoding_status: 'manual',
    }));
    expect(mockGeocodeListing).not.toHaveBeenCalled();
  });

  it('clears an incomplete manual coordinate pair before geocoding', async () => {
    const { writeChain } = mockUpdate();

    await updateListing(existingListing.id, { latitude: null });

    expect(writeChain.update).toHaveBeenCalledWith(expect.objectContaining({
      latitude: null,
      longitude: null,
      geocoding_status: 'pending',
    }));
    expect(mockGeocodeListing).toHaveBeenCalledWith(existingListing.id);
  });
});

describe('softDeleteListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes listing media from R2 and the database before soft-deleting the listing', async () => {
    const mediaChain = mockChain({
      data: [
        { id: 'media-1', object_key: 'listings/listing-1/photo.jpg' },
        { id: 'media-2', object_key: 'listings/listing-1/video.mp4' },
      ],
      error: null,
    });
    const mediaDeleteChain = mockChain({ data: null, error: null });
    const listingDeleteChain = mockChain({
      data: { ...existingListing, deleted_at: '2026-07-23T00:00:00.000Z' },
      error: null,
    });
    let calls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'listing_media') return listingDeleteChain;
      return [mediaChain, mediaDeleteChain][calls++]!;
    });

    const result = await softDeleteListing(existingListing.id);

    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(deleteObject).toHaveBeenCalledWith('listings/listing-1/photo.jpg');
    expect(deleteObject).toHaveBeenCalledWith('listings/listing-1/video.mp4');
    expect(mediaDeleteChain.delete).toHaveBeenCalled();
    expect(listingDeleteChain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(result.deleted_at).toBeTruthy();
  });
});

describe('listUserMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDownloadUrl.mockResolvedValue('https://media.example/photo.jpg');
  });

  it('groups completed media from one listing_media query', async () => {
    const mediaChain = mockChain({
      data: [{
        id: 'media-1',
        listing_id: 'listing-1',
        uploaded_by: 'agent-1',
        type: 'image',
        object_key: 'listings/listing-1/photo.jpg',
        original_filename: 'photo.jpg',
        upload_completed_at: '2026-07-14T00:00:00.000Z',
        sort_order: 0,
        logements: { id: 'listing-1', adresse: '123 Rue Test', deleted_at: null },
      }],
      error: null,
    });
    mockFrom.mockReturnValue(mediaChain);

    const groups = await listUserMedia('agent-1');

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mediaChain.eq).toHaveBeenCalledWith('uploaded_by', 'agent-1');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      listingId: 'listing-1',
      adresse: '123 Rue Test',
      media: [{
        id: 'media-1',
        viewUrl: 'https://media.example/photo.jpg',
        thumbnailUrl: 'https://media.example/photo.jpg',
      }],
    });
  });
});
