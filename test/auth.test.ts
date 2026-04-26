import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signDevToken } from '../src/io/auth.js';

const env = {
  NODE_ENV: 'test',
  PORT: 0,
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'a-very-long-test-secret-please',
  REDIS_URL: 'redis://localhost:6379',
  INSTANCE_ID: 'test',
  SLOW_CLIENT_QUEUE_LIMIT: 64,
  SLOW_CLIENT_DISCONNECT_AFTER_MS: 2000,
  DEMO_MODE: false,
} as const;

describe('signDevToken', () => {
  it('produces a JWT we can verify with the same secret', () => {
    const token = signDevToken(env, 'alice', 'Alice');
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; name?: string };
    expect(decoded.sub).toBe('alice');
    expect(decoded.name).toBe('Alice');
  });

  it('rejects tampered tokens', () => {
    const token = signDevToken(env, 'alice');
    const tampered = token.replace(/.$/, 'X');
    expect(() => jwt.verify(tampered, env.JWT_SECRET)).toThrow();
  });

  it('honors expiry', () => {
    const token = signDevToken(env, 'alice', undefined, -1);
    expect(() => jwt.verify(token, env.JWT_SECRET)).toThrow(/jwt expired/);
  });
});
