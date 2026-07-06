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

import { deleteArchivedLeads } from '../src/modules/jobs/deleteArchivedLeads.js';
import { cleanupStaleMediaReservations } from '../src/modules/jobs/staleMediaCleanup.js';
import { startJobs } from '../src/modules/jobs/startJobs.js';

describe('deleteArchivedLeads', () => {
  it('deletes only archived leads past delete_after', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: 'expired-1' }], error: null });
    const lte = vi.fn().mockReturnValue({ select });
    const not = vi.fn().mockReturnValue({ lte });
    const del = vi.fn().mockReturnValue({ not });
    mockFrom.mockReturnValue({ delete: del });

    const result = await deleteArchivedLeads(new Date('2030-01-01'));
    expect(result).toEqual([{ id: 'expired-1' }]);
    expect(not).toHaveBeenCalledWith('archived_at', 'is', null);
    expect(lte).toHaveBeenCalledWith('delete_after', expect.any(String));
  });
});

describe('cleanupStaleMediaReservations', () => {
  it('deletes stale pending reservations', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({
              data: [{ id: 'm1', object_key: 'k1' }],
              error: null,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({ eq: deleteEq }),
    });

    const cleaned = await cleanupStaleMediaReservations(new Date('2030-06-01'));
    expect(cleaned).toHaveLength(1);
    expect(deleteEq).toHaveBeenCalledWith('id', 'm1');
  });
});

describe('cron jobs', () => {
  it('registers jobs without throwing', () => {
    expect(() => startJobs()).not.toThrow();
  });
});
