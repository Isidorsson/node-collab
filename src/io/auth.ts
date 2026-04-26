import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Socket } from 'socket.io';
import type { Env } from '../config/env.js';

const ClaimsSchema = z.object({
  sub: z.string().min(1),
  name: z.string().min(1).max(64).optional(),
  exp: z.number().optional(),
});

export type Claims = z.infer<typeof ClaimsSchema>;

declare module 'socket.io' {
  interface Socket {
    /** Set by jwtAuth in `io.use()` — present on every connected socket. */
    user: Claims;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TODO(andreas): JWT expiry behavior is a security/UX trade-off.
//
// Current behavior: at handshake we verify expiry strictly. If a token expires
// MID-SESSION (e.g. an hour-long connection with a 15-min token), Socket.IO
// keeps the connection alive — we never re-check.
//
// Two reasonable policies (5–8 lines below):
//
//   A. Force-disconnect on expiry: setTimeout(() => socket.disconnect(true),
//      msUntilExpiry). Stricter — the client must reconnect with a fresh token.
//      Right for high-security contexts (admin tools, finance).
//
//   B. Grace period: at expiry, emit('token.refresh_required') and give the
//      client N seconds to send a new token via socket.emit('auth.refresh', t).
//      Better UX, slightly more code.
//
// Pick A for the demo (collab-board is single-tenant and short-lived). If this
// were a real product, B is usually right.
// ─────────────────────────────────────────────────────────────────────────────
export function createJwtAuth(env: Env): (socket: Socket, next: (err?: Error) => void) => void {
  return (socket, next) => {
    const token = pickToken(socket);
    if (!token) return next(new Error('missing token'));

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const parsed = ClaimsSchema.safeParse(decoded);
      if (!parsed.success) return next(new Error('invalid claims'));
      socket.user = parsed.data;
      return next();
    } catch (err) {
      return next(new Error(err instanceof Error ? err.message : 'jwt verification failed'));
    }
  };
}

function pickToken(socket: Socket): string | undefined {
  const auth = socket.handshake.auth as { token?: unknown };
  if (typeof auth?.token === 'string' && auth.token.length > 0) return auth.token;

  const header = socket.handshake.headers['authorization'];
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);

  return undefined;
}

export function signDevToken(env: Env, sub: string, name?: string, ttlSeconds = 3600): string {
  return jwt.sign({ sub, name }, env.JWT_SECRET, { expiresIn: ttlSeconds });
}
