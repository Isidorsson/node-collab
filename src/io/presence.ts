import type { Redis } from 'ioredis';
import type { PresenceEntry } from './protocol.js';

const TTL_SECONDS = 60;

function key(room: string): string {
  return `collab:presence:${room}`;
}

export async function joinPresence(
  redis: Redis,
  room: string,
  entry: PresenceEntry,
): Promise<PresenceEntry[]> {
  const k = key(room);
  await redis.hset(k, entry.userId, JSON.stringify(entry));
  await redis.expire(k, TTL_SECONDS);
  return await listPresence(redis, room);
}

export async function leavePresence(
  redis: Redis,
  room: string,
  userId: string,
): Promise<PresenceEntry[]> {
  await redis.hdel(key(room), userId);
  return await listPresence(redis, room);
}

export async function listPresence(redis: Redis, room: string): Promise<PresenceEntry[]> {
  const raw = await redis.hgetall(key(room));
  return Object.values(raw)
    .map((s) => safeParse(s))
    .filter((v): v is PresenceEntry => v !== null);
}

export async function refreshPresence(redis: Redis, room: string): Promise<void> {
  await redis.expire(key(room), TTL_SECONDS);
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
