import cron from 'node-cron';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { syncAllSheets } from '../sheets/sheets.service.js';
import { cleanupStaleMediaReservations } from './staleMediaCleanup.js';

function hasGoogleSheetsConfig() {
  return Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    && env.GOOGLE_SHEET_FAST_RENTAL_ID
    && env.GOOGLE_SHEET_ORCHA_ID,
  );
}

async function runSheetSyncJob(label: string) {
  try {
    logger.info(`Running sheet sync (${label})`);
    const result = await syncAllSheets();
    logger.info({ result }, 'Sheet sync finished');
  } catch (err) {
    logger.error({ err }, `Sheet sync failed (${label})`);
  }
}

export function startJobs() {
  cron.schedule(env.CRON_SHEET_SYNC, async () => {
    await runSheetSyncJob('cron');
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

  if (env.RUN_SHEET_SYNC_ON_STARTUP && hasGoogleSheetsConfig()) {
    void runSheetSyncJob('startup');
  } else if (env.RUN_SHEET_SYNC_ON_STARTUP) {
    logger.warn('Sheet sync at startup skipped — configure GOOGLE_SERVICE_ACCOUNT_*, GOOGLE_SHEET_FAST_RENTAL_ID, and GOOGLE_SHEET_ORCHA_ID');
  } else {
    logger.info('Sheet sync at startup disabled');
  }
}
