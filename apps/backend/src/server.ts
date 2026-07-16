import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { registerGracefulShutdown } from './lifecycle/shutdown.js';
import { startJobs, stopJobs } from './modules/jobs/startJobs.js';
import { isLocalStorage } from './modules/media/storage.service.js';

const port = env.PORT;

if (env.NODE_ENV !== 'test') {
  const server = createServer(
    { maxHeaderSize: env.HTTP_MAX_HEADER_SIZE_BYTES },
    app,
  );
  server.headersTimeout = env.HTTP_HEADERS_TIMEOUT_MS;
  server.requestTimeout = env.HTTP_REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = env.HTTP_KEEP_ALIVE_TIMEOUT_MS;
  server.maxHeadersCount = 100;
  server.setTimeout(env.HTTP_REQUEST_TIMEOUT_MS);

  // The API has no HTTP tunnel or WebSocket endpoints.
  server.on('connect', (_req, socket) => {
    socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n');
  });
  server.on('upgrade', (_req, socket) => {
    socket.end();
  });

  registerGracefulShutdown(server, stopJobs);

  server.listen(port, env.HOST, () => {
    logger.info({
      host: env.HOST,
      port,
      storage: isLocalStorage() ? 'local' : 'r2',
    }, 'API listening');
    startJobs();
  });
}
