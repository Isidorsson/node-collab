import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { loadEnv } from './config/env.js';
import { createLogger } from './obs/logger.js';
import { createHttpApp } from './app.js';
import { createJwtAuth } from './io/auth.js';
import { registerSocketHandlers } from './io/handlers.js';
import {
  createMemoryPresenceStore,
  createRedisPresenceStore,
  type PresenceStore,
} from './io/presence.js';

interface RedisClients {
  pub: Redis;
  sub: Redis;
  presence: Redis;
}

async function setupRedis(redisUrl: string): Promise<RedisClients> {
  const pub = new Redis(redisUrl, { lazyConnect: true });
  const sub = pub.duplicate();
  const presence = pub.duplicate();
  await Promise.all([pub.connect(), sub.connect(), presence.connect()]);
  return { pub, sub, presence };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  const app = createHttpApp({ env, logger });
  const httpServer = createServer(app);

  const io = new IOServer(httpServer, {
    cors: { origin: true, credentials: false },
    transports: ['websocket', 'polling'],
    pingTimeout: 20_000,
    maxHttpBufferSize: 64 * 1024,
  });

  let redisClients: RedisClients | null = null;
  let presenceStore: PresenceStore;

  if (env.REDIS_URL) {
    try {
      redisClients = await setupRedis(env.REDIS_URL);
      logger.info({ url: env.REDIS_URL }, 'redis connected — multi-instance mode');
      redisClients.pub.on('error', (err: Error) => logger.error({ err }, 'redis pub error'));
      redisClients.sub.on('error', (err: Error) => logger.error({ err }, 'redis sub error'));
      redisClients.presence.on('error', (err: Error) =>
        logger.error({ err }, 'redis presence error'),
      );
      io.adapter(createAdapter(redisClients.pub, redisClients.sub));
      presenceStore = createRedisPresenceStore(redisClients.presence);
    } catch (err) {
      logger.error(
        { err },
        'redis connection failed — falling back to single-instance memory mode',
      );
      presenceStore = createMemoryPresenceStore();
    }
  } else {
    logger.warn('REDIS_URL not set — running in single-instance memory mode');
    presenceStore = createMemoryPresenceStore();
  }

  io.use(createJwtAuth(env));
  registerSocketHandlers({ io, presence: presenceStore, env, logger });

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, instance: env.INSTANCE_ID, mode: redisClients ? 'redis' : 'memory' },
      'node-collab listening',
    );
    if (env.DEMO_MODE && env.NODE_ENV === 'production') {
      logger.warn(
        'DEMO_MODE is enabled in production — /dev/token mints unauthenticated JWTs. Acceptable for portfolio demos, NEVER for a real service.',
      );
    }
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
      if (redisClients) {
        await Promise.allSettled([
          redisClients.pub.quit(),
          redisClients.sub.quit(),
          redisClients.presence.quit(),
        ]);
      }
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
