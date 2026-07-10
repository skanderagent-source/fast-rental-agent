import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { supabaseAdmin } from '../../db/supabaseAdmin.js';
import { logActivity } from '../activity/activity.service.js';
import { geocodeAllPendingListings } from '../listings/listings.geocode.js';
import type { ParsedSheetRow } from './sheetMappings.js';
import { collectAllSheetRows } from './sheets.reader.js';
import { buildChangedSheetUpdates, hasAddressFieldChange } from './sheets.compare.js';

const BATCH_SIZE = 100;

type UpsertResult = {
  action: 'inserted' | 'updated' | 'skipped';
  id: string;
  addressChanged?: boolean;
};

function rowToPayload(row: ParsedSheetRow): Record<string, unknown> {
  return {
    adresse: row.adresse,
    quartier: row.quartier,
    ville: row.ville,
    prix: row.prix,
    taille: row.taille,
    statut: row.statut,
    electromenagers: row.electromenagers,
    code_entree: row.code_entree,
    concierge_tel: row.concierge_tel,
    notes: row.notes,
    date_disponibilite: row.date_disponibilite,
    locataire_nom: row.locataire_nom,
    locataire_tel: row.locataire_tel,
    source: row.source,
    sheet_row_id: row.sheet_row_id,
    geocoding_status: 'pending',
  };
}

function summarizeRows(rows: ParsedSheetRow[]) {
  const bySource: Record<string, number> = {};
  const byStatut: Record<string, number> = {};
  for (const row of rows) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    byStatut[row.statut] = (byStatut[row.statut] ?? 0) + 1;
  }
  return { bySource, byStatut };
}

export async function previewSheetImport() {
  const { rows, stats } = await collectAllSheetRows();
  return {
    total: rows.length,
    stats,
    sample: rows.slice(0, 6),
    summary: summarizeRows(rows),
  };
}

async function upsertRow(row: ParsedSheetRow, mode: 'import' | 'sync'): Promise<UpsertResult> {
  const payload = rowToPayload(row);
  const { data: existing } = await supabaseAdmin
    .from('logements')
    .select('*')
    .eq('sheet_row_id', row.sheet_row_id)
    .maybeSingle();

  if (existing) {
    const overrides = mode === 'sync'
      ? ((existing.manual_overrides ?? {}) as Record<string, boolean>)
      : {};

    const updates = buildChangedSheetUpdates(existing, payload, overrides);
    if (!updates) {
      return { action: 'skipped', id: existing.id };
    }

    const { data, error } = await supabaseAdmin
      .from('logements')
      .update(updates)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw error;
    return {
      action: 'updated',
      id: data.id,
      addressChanged: hasAddressFieldChange(updates),
    };
  }

  const insertPayload = {
    ...payload,
    sheet_updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from('logements')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error) throw error;
  return { action: 'inserted', id: data.id, addressChanged: true };
}

async function runSheetJob(
  mode: 'import' | 'sync',
  activityType: 'sheet_import_started' | 'sheet_sync_started',
  activityDone: 'sheet_import_finished' | 'sheet_sync_finished',
) {
  const runInsert = {
    source: 'all',
    spreadsheet_id: env.GOOGLE_SHEET_FAST_RENTAL_ID,
    status: 'running',
    started_at: new Date().toISOString(),
  };
  const { data: run } = await supabaseAdmin.from('sheet_sync_runs').insert(runInsert).select('*').single();

  let rowsSeen = 0;
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  let rowsErrored = 0;
  let needsGeocode = false;

  await logActivity({
    agentId: '00000000-0000-0000-0000-000000000000',
    agentNom: 'System',
    typeAction: activityType,
    details: mode === 'import' ? 'Import Google Sheets démarré' : 'Synchronisation Google Sheets démarrée',
  });

  try {
    const { rows, stats } = await collectAllSheetRows();
    rowsSeen = rows.length;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      for (const row of batch) {
        try {
          const result = await upsertRow(row, mode);
          if (result.action === 'inserted') {
            rowsInserted++;
            needsGeocode = true;
          } else if (result.action === 'updated') {
            rowsUpdated++;
            if (result.addressChanged) needsGeocode = true;
          } else {
            rowsSkipped++;
          }
        } catch {
          rowsErrored++;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    await supabaseAdmin.from('sheet_sync_runs').update({
      status: rowsErrored ? 'partial' : 'success',
      rows_seen: rowsSeen,
      rows_inserted: rowsInserted,
      rows_updated: rowsUpdated,
      rows_skipped: rowsSkipped,
      error_message: rowsErrored ? `${rowsErrored} row(s) failed` : null,
      finished_at: new Date().toISOString(),
    }).eq('id', run!.id);

    await logActivity({
      agentId: '00000000-0000-0000-0000-000000000000',
      agentNom: 'System',
      typeAction: activityDone,
      details: `${rowsInserted} insérés, ${rowsUpdated} mis à jour, ${rowsSkipped} inchangés, ${rowsErrored} erreurs`,
    });

    if (needsGeocode) {
      void geocodeAllPendingListings().catch((err) => {
        logger.error({ err }, 'Background geocoding after sheet job failed');
      });
    }

    return {
      mode,
      total: rows.length,
      stats,
      rowsInserted,
      rowsUpdated,
      rowsSkipped,
      rowsErrored,
      summary: summarizeRows(rows),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sheet job failed';
    await supabaseAdmin.from('sheet_sync_runs').update({
      status: 'failed',
      rows_seen: rowsSeen,
      rows_inserted: rowsInserted,
      rows_updated: rowsUpdated,
      rows_skipped: rowsSkipped,
      error_message: message,
      finished_at: new Date().toISOString(),
    }).eq('id', run!.id);
    throw err;
  }
}

/** One-time bulk import from Google Sheets (UPSERT by sheet_row_id). */
export async function importSheetsFromGoogle() {
  return runSheetJob('import', 'sheet_import_started', 'sheet_import_finished');
}

/** Re-sync with manual_overrides protection (optional, post-import). */
export async function syncAllSheets() {
  return runSheetJob('sync', 'sheet_sync_started', 'sheet_sync_finished');
}

export async function getSheetRuns() {
  const { data, error } = await supabaseAdmin
    .from('sheet_sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export { validateSheetHasAddressColumn } from './sheetMappings.js';
