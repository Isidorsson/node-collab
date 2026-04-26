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
  /**
   * Opt-in flag that enables the unauthenticated `/dev/token` endpoint, used
   * by the bundled demo page to mint a JWT without an auth flow. Default OFF
   * for secure-by-default. Set `DEMO_MODE=true` to enable on portfolio /
   * showcase deployments. Never enable on a real production service.
   *
   * In local development this defaults to ON via the auto-rule below
   * (NODE_ENV=development → DEMO_MODE=true), so `npm run dev` just works.
   */
  DEMO_MODE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
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

  const env = parsed.data;

  // Convenience: auto-enable DEMO_MODE in local dev when not explicitly set.
  // Production must opt in by setting DEMO_MODE=true explicitly.
  if (env.NODE_ENV === 'development' && process.env['DEMO_MODE'] === undefined) {
    return { ...env, DEMO_MODE: true };
  }
  return env;
}
