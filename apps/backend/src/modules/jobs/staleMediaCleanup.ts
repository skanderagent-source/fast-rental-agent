import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { deleteObject } from '../media/storage.service.js';

/** Removes stale pending media reservations older than 24h without completed upload. */
export async function cleanupStaleMediaReservations(now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 3600000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('listing_media')
    .select('id, object_key')
    .eq('status', 'pending')
    .is('upload_completed_at', null)
    .lt('created_at', cutoff);
  if (error) throw error;
  for (const row of data ?? []) {
    try {
      await deleteObject(row.object_key);
    } catch {
      // Best-effort R2 cleanup; DB row is still removed to release quota.
    }
    await supabaseAdmin.from('listing_media').delete().eq('id', row.id);
  }
  return data ?? [];
}
