import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
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
    res.json({ status: 'ok', service: 'node-collab', instance: ctx.env.INSTANCE_ID });
  });

  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  // Dev helper: mint a JWT so the demo page can connect without an auth UI.
  // Disabled in production — set up a real auth flow before going live.
  if (ctx.env.NODE_ENV !== 'production') {
    app.get('/dev/token', (req, res) => {
      const sub = String(req.query.sub ?? `user-${Math.random().toString(36).slice(2, 8)}`);
      const name = typeof req.query.name === 'string' ? req.query.name : undefined;
      res.json({ token: signDevToken(ctx.env, sub, name) });
    });
  }

  app.use(express.static('public'));
  return app;
}
