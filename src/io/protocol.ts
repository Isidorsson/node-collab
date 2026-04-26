import { z } from 'zod';

export const RoomName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'room name must be alphanumeric/underscore/hyphen');

export const JoinPayload = z.object({ room: RoomName });

export const ChatPayload = z.object({
  room: RoomName,
  text: z.string().min(1).max(2000),
});

export const CursorPayload = z.object({
  room: RoomName,
  x: z.number().finite(),
  y: z.number().finite(),
});

export interface PresenceEntry {
  userId: string;
  name?: string | undefined;
  joinedAt: number;
}

/** Server-to-client event names. */
export const EVENTS = {
  presence: 'presence',
  chat: 'chat',
  cursor: 'cursor',
  systemError: 'system.error',
  authRequired: 'auth.required',
} as const;
