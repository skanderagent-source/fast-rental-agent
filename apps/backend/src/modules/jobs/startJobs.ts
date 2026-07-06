import cron from 'node-cron';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { syncAllSheets } from '../sheets/sheets.service.js';
import { deleteArchivedLeads } from './deleteArchivedLeads.js';
import { cleanupStaleMediaReservations } from './staleMediaCleanup.js';

export function startJobs() {
  cron.schedule(env.CRON_ARCHIVE_DELETE, async () => {
    logger.info('Running archive delete job');
    try {
      const deleted = await deleteArchivedLeads();
      logger.info({ count: deleted.length }, 'Archived leads deleted');
    } catch (error) {
      logger.error({ error }, 'Archive delete failed');
    }
  });

  cron.schedule(env.CRON_SHEET_SYNC, async () => {
    try {
      logger.info('Running sheet sync job');
      await syncAllSheets();
    } catch (err) {
      logger.error({ err }, 'Sheet sync job failed');
    }
  });

  cron.schedule(env.CRON_STALE_MEDIA_CLEANUP, async () => {
    logger.info('Running stale media cleanup');
    try {
      const cleaned = await cleanupStaleMediaReservations();
      logger.info({ count: cleaned.length }, 'Stale media reservations cleaned');
    } catch (err) {
      logger.error({ err }, 'Stale media cleanup failed');
    }
  });
}
