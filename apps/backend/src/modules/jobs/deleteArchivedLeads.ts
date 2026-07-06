import { supabaseAdmin } from '../../db/supabaseAdmin.js';

/** Deletes archived leads whose delete_after has passed. Exported for tests. */
export async function deleteArchivedLeads(now = new Date()) {
  const { data, error } = await supabaseAdmin
    .from('demandes_clients')
    .delete()
    .not('archived_at', 'is', null)
    .lte('delete_after', now.toISOString())
    .select('id');
  if (error) throw error;
  return data ?? [];
}
