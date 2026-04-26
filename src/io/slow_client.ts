import type { Socket } from 'socket.io';
import { slowClientEvictions } from '../obs/metrics.js';
import type { Env } from '../config/env.js';
import type { Logger } from '../obs/logger.js';

interface SlowClientCtx {
  env: Env;
  logger: Logger;
}

// ─────────────────────────────────────────────────────────────────────────────
// TODO(andreas): Slow-client policy.
//
// You already made this trade-off in collab-board (Go): bounded send buffer +
// non-blocking TrySend + eviction. Socket.IO doesn't expose its internal write
// buffer the same way, so you have two levers in Node:
//
//   1. socket.conn.transport.writable — false while the underlying transport
//      is paused. If we observe this `false` for > N ms, the client is slow.
//   2. ack timeouts — emit critical events with `socket.timeout(N).emit(...)`
//      and count failures.
//
// Current default below uses lever #1 with the queue-limit and timeout from env.
// Try lever #2 for the chat channel (it's worth knowing if the user actually
// got the message). Keep cursor updates lossy via socket.volatile.emit().
//
// Whichever policy you pick: increment slowClientEvictions and call
// socket.disconnect(true) — never silently drop, always make it observable.
// ─────────────────────────────────────────────────────────────────────────────
export function attachSlowClientWatcher(socket: Socket, ctx: SlowClientCtx): void {
  let stalledSince: number | null = null;

  const interval = setInterval(() => {
    const transport = socket.conn?.transport;
    const writable = transport?.writable !== false;

    if (writable) {
      stalledSince = null;
      return;
    }

    if (stalledSince === null) {
      stalledSince = Date.now();
      return;
    }

    if (Date.now() - stalledSince >= ctx.env.SLOW_CLIENT_DISCONNECT_AFTER_MS) {
      ctx.logger.warn(
        { socketId: socket.id, userId: socket.user?.sub, stalledMs: Date.now() - stalledSince },
        'evicting slow client',
      );
      slowClientEvictions.inc({ instance: ctx.env.INSTANCE_ID, reason: 'stalled_transport' });
      socket.disconnect(true);
    }
  }, 250);
  interval.unref();

  socket.on('disconnect', () => clearInterval(interval));
}
