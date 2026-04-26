import type { Server as IOServer, Socket } from 'socket.io';
import type { Logger } from '../obs/logger.js';
import type { Env } from '../config/env.js';
import { ChatPayload, CursorPayload, EVENTS, JoinPayload } from './protocol.js';
import { attachSlowClientWatcher } from './slow_client.js';
import type { PresenceStore } from './presence.js';
import {
  activeRooms,
  activeSockets,
  messagesDelivered,
  messagesPublished,
} from '../obs/metrics.js';

export interface RegisterOptions {
  io: IOServer;
  presence: PresenceStore;
  env: Env;
  logger: Logger;
}

export function registerSocketHandlers(opts: RegisterOptions): void {
  const { io, presence, env, logger } = opts;
  const joinedRooms = new Map<string, Set<string>>();

  io.on('connection', (socket) => {
    const log = logger.child({ socketId: socket.id, userId: socket.user.sub });
    log.info({ instance: env.INSTANCE_ID }, 'connected');
    activeSockets.inc({ instance: env.INSTANCE_ID });
    attachSlowClientWatcher(socket, { env, logger: log });

    const userRooms = new Set<string>();

    socket.on('room.join', async (raw: unknown, ack?: (ok: boolean) => void) => {
      const parsed = JoinPayload.safeParse(raw);
      if (!parsed.success) {
        socket.emit(EVENTS.systemError, { error: 'invalid_room' });
        ack?.(false);
        return;
      }
      const { room } = parsed.data;
      await socket.join(room);
      userRooms.add(room);

      const trackingSet = joinedRooms.get(room) ?? new Set<string>();
      const wasEmpty = trackingSet.size === 0;
      trackingSet.add(socket.id);
      joinedRooms.set(room, trackingSet);
      if (wasEmpty) activeRooms.inc({ instance: env.INSTANCE_ID });

      const entry = {
        userId: socket.user.sub,
        name: socket.user.name,
        joinedAt: Date.now(),
      };
      const present = await presence.join(room, entry);
      io.to(room).emit(EVENTS.presence, { room, present });
      messagesPublished.inc({ instance: env.INSTANCE_ID, channel: 'presence' });
      ack?.(true);
    });

    socket.on('room.leave', async (raw: unknown) => {
      const parsed = JoinPayload.safeParse(raw);
      if (!parsed.success) return;
      await leaveRoom(socket, parsed.data.room);
    });

    socket.on('chat', (raw: unknown, ack?: (ok: boolean) => void) => {
      const parsed = ChatPayload.safeParse(raw);
      if (!parsed.success) {
        ack?.(false);
        return;
      }
      const { room, text } = parsed.data;
      if (!userRooms.has(room)) {
        ack?.(false);
        return;
      }
      io.to(room).emit(EVENTS.chat, {
        room,
        userId: socket.user.sub,
        name: socket.user.name,
        text,
        at: Date.now(),
      });
      messagesPublished.inc({ instance: env.INSTANCE_ID, channel: 'chat' });
      messagesDelivered.inc({ instance: env.INSTANCE_ID, channel: 'chat' });
      ack?.(true);
    });

    socket.on('cursor', (raw: unknown) => {
      const parsed = CursorPayload.safeParse(raw);
      if (!parsed.success) return;
      const { room, x, y } = parsed.data;
      if (!userRooms.has(room)) return;
      socket.volatile.to(room).emit(EVENTS.cursor, { room, userId: socket.user.sub, x, y });
      messagesPublished.inc({ instance: env.INSTANCE_ID, channel: 'cursor' });
    });

    socket.on('disconnect', async (reason) => {
      log.info({ reason }, 'disconnected');
      activeSockets.dec({ instance: env.INSTANCE_ID });
      for (const room of userRooms) {
        await leaveRoom(socket, room).catch(() => undefined);
      }
    });

    async function leaveRoom(s: Socket, room: string): Promise<void> {
      await s.leave(room);
      userRooms.delete(room);

      const tracking = joinedRooms.get(room);
      if (tracking) {
        tracking.delete(s.id);
        if (tracking.size === 0) {
          joinedRooms.delete(room);
          activeRooms.dec({ instance: env.INSTANCE_ID });
        }
      }

      const present = await presence.leave(room, s.user.sub);
      io.to(room).emit(EVENTS.presence, { room, present });
      messagesPublished.inc({ instance: env.INSTANCE_ID, channel: 'presence' });
    }
  });

  // Refresh presence TTL for any local rooms periodically (no-op in memory mode).
  const refresh = setInterval(async () => {
    const rooms = Array.from(joinedRooms.keys());
    await Promise.all(rooms.map((r) => presence.refresh(r).catch(() => undefined)));
  }, 30_000);
  refresh.unref();
}
