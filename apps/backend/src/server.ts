import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startJobs } from './modules/jobs/startJobs.js';
import { isLocalStorage } from './modules/media/storage.service.js';

const port = env.PORT;

if (env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info({ port, storage: isLocalStorage() ? 'local' : 'r2' }, 'API listening');
    startJobs();
  });
}
