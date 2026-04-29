import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env.js';
import type { Logger } from './obs/logger.js';
import { registry } from './obs/metrics.js';
import { signDevToken } from './io/auth.js';

export interface HttpContext {
  env: Env;
  logger: Logger;
}

export function createHttpApp(ctx: HttpContext): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(pinoHttp({ logger: ctx.logger }));

  app.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'node-collab',
      instance: ctx.env.INSTANCE_ID,
      mode: ctx.env.REDIS_URL ? 'redis' : 'memory',
    });
  });

  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  // Demo helper: mint a JWT so the bundled SPA can connect without a real
  // auth flow. Gated behind DEMO_MODE — opt-in in production, on by default
  // in local dev. Replace with a proper auth flow for non-demo deployments.
  if (ctx.env.DEMO_MODE) {
    app.get('/dev/token', (req, res) => {
      const sub = String(req.query.sub ?? `user-${Math.random().toString(36).slice(2, 8)}`);
      const name = typeof req.query.name === 'string' ? req.query.name : undefined;
      res.json({ token: signDevToken(ctx.env, sub, name) });
    });
  }

  // The Angular CLI emits the SPA bundle to public/browser/ via the
  // application builder. If that directory is missing (someone ran the
  // backend without building the frontend), fall back to the legacy
  // public/ root. The healthcheck still works either way.
  const browserDir = path.resolve('public/browser');
  const staticRoot = existsSync(path.join(browserDir, 'index.html'))
    ? browserDir
    : path.resolve('public');
  ctx.logger.info({ staticRoot }, 'serving static assets');

  app.use(
    express.static(staticRoot, {
      // Fingerprinted JS/CSS get long-lived caching; HTML stays fresh so the
      // user picks up new bundle hashes on next reload.
      setHeaders: (res, filePath) => {
        if (/\.(?:js|css|woff2?|svg|png|jpg|webp)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // SPA fallback — any GET that didn't match a static asset, the metrics/
  // health endpoints, or socket.io routes is the Angular shell. Skips API
  // and Socket.IO paths so they fail loudly instead of returning HTML.
  app.get(/^\/(?!socket\.io|metrics|healthz|dev\/).*/, (_req, res, next) => {
    const indexHtml = path.join(staticRoot, 'index.html');
    if (!existsSync(indexHtml)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });

  return app;
}
