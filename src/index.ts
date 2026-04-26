import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { loadEnv } from './config/env.js';
import { createLogger } from './obs/logger.js';
import { createHttpApp } from './app.js';
import { createJwtAuth } from './io/auth.js';
import { registerSocketHandlers } from './io/handlers.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  const app = createHttpApp({ env, logger });
  const httpServer = createServer(app);

  const pubClient = new Redis(env.REDIS_URL, { lazyConnect: true });
  const subClient = pubClient.duplicate();
  const presenceClient = pubClient.duplicate();

  pubClient.on('error', (err: Error) => logger.error({ err }, 'redis pub error'));
  subClient.on('error', (err: Error) => logger.error({ err }, 'redis sub error'));
  presenceClient.on('error', (err: Error) => logger.error({ err }, 'redis presence error'));

  await Promise.all([pubClient.connect(), subClient.connect(), presenceClient.connect()]);
  logger.info({ url: env.REDIS_URL }, 'redis connected');

  const io = new IOServer(httpServer, {
    cors: { origin: true, credentials: false },
    transports: ['websocket', 'polling'],
    pingTimeout: 20_000,
    maxHttpBufferSize: 64 * 1024,
  });
  io.adapter(createAdapter(pubClient, subClient));
  io.use(createJwtAuth(env));
  registerSocketHandlers({ io, redis: presenceClient, env, logger });

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, instance: env.INSTANCE_ID }, 'node-collab listening');
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown initiated');

    const deadline = setTimeout(() => {
      logger.warn('forcing exit after 10s shutdown deadline');
      process.exit(1);
    }, 10_000);
    deadline.unref();

    try {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      httpServer.close();
      await Promise.allSettled([pubClient.quit(), subClient.quit(), presenceClient.quit()]);
      logger.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    void shutdown('uncaughtException');
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`startup failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
