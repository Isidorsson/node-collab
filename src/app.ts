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

  // Demo helper: mint a JWT so the bundled demo page can connect without an
  // auth UI. Gated behind DEMO_MODE — must be opted into explicitly in
  // production. Auto-enabled in local dev. Never expose this on a real
  // service; set up a proper auth flow instead.
  if (ctx.env.DEMO_MODE) {
    app.get('/dev/token', (req, res) => {
      const sub = String(req.query.sub ?? `user-${Math.random().toString(36).slice(2, 8)}`);
      const name = typeof req.query.name === 'string' ? req.query.name : undefined;
      res.json({ token: signDevToken(ctx.env, sub, name) });
    });
  }

  app.use(express.static('public'));
  return app;
}
