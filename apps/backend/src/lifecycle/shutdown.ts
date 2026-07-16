import type { Server } from 'node:http';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export function registerGracefulShutdown(server: Server, stopJobs: () => void) {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutdown requested');

    stopJobs();

    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
        return;
      }
      logger.info('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error({ graceMs: env.SHUTDOWN_GRACE_MS }, 'Forced shutdown after grace period');
      process.exit(1);
    }, env.SHUTDOWN_GRACE_MS).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
