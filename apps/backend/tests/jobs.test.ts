import { describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();

vi.mock('../src/db/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../src/modules/sheets/sheets.service.js', () => ({
  syncAllSheets: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../src/modules/media/storage.service.js', () => ({
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

import { cleanupStaleMediaReservations } from '../src/modules/jobs/staleMediaCleanup.js';
import { deleteObject } from '../src/modules/media/storage.service.js';
import { startJobs, stopJobs } from '../src/modules/jobs/startJobs.js';

describe('cleanupStaleMediaReservations', () => {
  it('deletes stale pending reservations', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({
              data: [{ id: 'm1', object_key: 'listings/l1/uuid/a.jpg' }],
              error: null,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({ eq: deleteEq }),
    });

    const cleaned = await cleanupStaleMediaReservations(new Date('2030-06-01'));
    expect(cleaned).toHaveLength(1);
    expect(deleteObject).toHaveBeenCalledWith('listings/l1/uuid/a.jpg');
    expect(deleteEq).toHaveBeenCalledWith('id', 'm1');
  });
});

describe('cron jobs', () => {
  it('registers jobs without throwing', () => {
    expect(() => startJobs()).not.toThrow();
  });

  it('stops scheduled jobs without throwing', () => {
    startJobs();
    expect(() => stopJobs()).not.toThrow();
    expect(() => stopJobs()).not.toThrow();
  });
});
