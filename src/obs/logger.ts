import pino from 'pino';
import type { Env } from '../config/env.js';

export function createLogger(env: Env): pino.Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: 'node-collab', instance: env.INSTANCE_ID, env: env.NODE_ENV },
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
        : undefined,
  });
}

export type Logger = pino.Logger;
