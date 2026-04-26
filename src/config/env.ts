import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  /**
   * Optional. When set, Socket.IO uses the Redis adapter for cross-instance
   * pub/sub and presence is shared across replicas. When unset, the server
   * runs in single-instance mode with in-memory state.
   */
  REDIS_URL: z.string().url().optional(),
  INSTANCE_ID: z.string().default('instance-1'),
  SLOW_CLIENT_QUEUE_LIMIT: z.coerce.number().int().positive().default(64),
  SLOW_CLIENT_DISCONNECT_AFTER_MS: z.coerce.number().int().positive().default(2000),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
