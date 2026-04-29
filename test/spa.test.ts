import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createHttpApp } from '../src/app.js';
import { createLogger } from '../src/obs/logger.js';
import type { Env } from '../src/config/env.js';

/**
 * Verifies the static-and-SPA-fallback contract added when the Angular
 * frontend was wired up:
 *   1. Real static assets get long-lived cache headers
 *   2. /healthz, /metrics, /dev/* still pass through to their handlers
 *   3. Any other GET serves the SPA index.html (so client-side routes work)
 */

const browserDir = path.resolve('public/browser');
const indexPath = path.join(browserDir, 'index.html');
const stubAsset = path.join(browserDir, 'main-test.js');

const env: Env = {
  PORT: 0,
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-at-least-16-chars',
  INSTANCE_ID: 'test-spa',
  DEMO_MODE: false,
  LOG_LEVEL: 'silent',
  SLOW_CLIENT_QUEUE_LIMIT: 64,
  SLOW_CLIENT_DISCONNECT_AFTER_MS: 2000,
};
const logger = createLogger(env);

let server: ReturnType<ReturnType<typeof createHttpApp>['listen']>;
let baseUrl = '';

beforeAll(async () => {
  mkdirSync(browserDir, { recursive: true });
  writeFileSync(indexPath, '<!doctype html><html><body><nc-root></nc-root></body></html>');
  writeFileSync(stubAsset, '/* test asset */');

  const app = createHttpApp({ env, logger });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(stubAsset, { force: true });
  rmSync(indexPath, { force: true });
});

describe('http app — SPA fallback', () => {
  it('serves the index.html for unknown SPA routes', async () => {
    const res = await fetch(`${baseUrl}/r/observatory`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('<nc-root>');
  });

  it('does not serve HTML for /socket.io/ paths (would break the handshake)', async () => {
    const res = await fetch(`${baseUrl}/socket.io/`);
    expect(res.status).not.toBe(200);
  });

  it('responds JSON on /healthz, not HTML', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; instance: string };
    expect(body.service).toBe('node-collab');
    expect(body.instance).toBe('test-spa');
  });

  it('caches fingerprinted bundle assets immutably', async () => {
    const res = await fetch(`${baseUrl}/main-test.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/immutable/);
  });

  it('keeps index.html fresh (no-cache) so users pick up new bundle hashes', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/no-cache/);
  });

  it('returns 404 for /dev/token when DEMO_MODE is off', async () => {
    const res = await fetch(`${baseUrl}/dev/token`);
    expect(res.status).toBe(404);
  });
});
