import type { Redis } from 'ioredis';
import type { PresenceEntry } from './protocol.js';

/**
 * Backing store for room presence. Two implementations:
 *
 *   - {@link createRedisPresenceStore} — shared across replicas via Redis hash
 *     with TTL. Use this when REDIS_URL is set.
 *   - {@link createMemoryPresenceStore} — single-instance only, in-memory.
 *     Use this when there's no Redis available; the server still works for
 *     single-replica deployments and local dev.
 */
export interface PresenceStore {
  join(room: string, entry: PresenceEntry): Promise<PresenceEntry[]>;
  leave(room: string, userId: string): Promise<PresenceEntry[]>;
  list(room: string): Promise<PresenceEntry[]>;
  refresh(room: string): Promise<void>;
}

const REDIS_TTL_SECONDS = 60;
const REDIS_KEY_PREFIX = 'collab:presence:';

export function createRedisPresenceStore(redis: Redis): PresenceStore {
  const key = (room: string): string => `${REDIS_KEY_PREFIX}${room}`;

  const list = async (room: string): Promise<PresenceEntry[]> => {
    const raw = await redis.hgetall(key(room));
    return Object.values(raw)
      .map(safeParse)
      .filter((v): v is PresenceEntry => v !== null);
  };

  return {
    async join(room, entry) {
      const k = key(room);
      await redis.hset(k, entry.userId, JSON.stringify(entry));
      await redis.expire(k, REDIS_TTL_SECONDS);
      return list(room);
    },
    async leave(room, userId) {
      await redis.hdel(key(room), userId);
      return list(room);
    },
    list,
    async refresh(room) {
      await redis.expire(key(room), REDIS_TTL_SECONDS);
    },
  };
}

export function createMemoryPresenceStore(): PresenceStore {
  const rooms = new Map<string, Map<string, PresenceEntry>>();

  const getRoom = (room: string): Map<string, PresenceEntry> => {
    let r = rooms.get(room);
    if (!r) {
      r = new Map();
      rooms.set(room, r);
    }
    return r;
  };

  return {
    async join(room, entry) {
      getRoom(room).set(entry.userId, entry);
      return Array.from(getRoom(room).values());
    },
    async leave(room, userId) {
      const r = rooms.get(room);
      if (r) {
        r.delete(userId);
        if (r.size === 0) rooms.delete(room);
      }
      return Array.from(rooms.get(room)?.values() ?? []);
    },
    async list(room) {
      return Array.from(rooms.get(room)?.values() ?? []);
    },
    async refresh() {
      // no-op for in-memory store
    },
  };
}

function safeParse(s: string): PresenceEntry | null {
  try {
    const v = JSON.parse(s) as unknown;
    if (
      v !== null &&
      typeof v === 'object' &&
      'userId' in v &&
      typeof (v as PresenceEntry).userId === 'string'
    ) {
      return v as PresenceEntry;
    }
    return null;
  } catch {
    return null;
  }
}
