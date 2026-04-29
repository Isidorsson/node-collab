/**
 * Wire protocol shared with the Node backend (`src/io/protocol.ts`).
 * Field names and event names MUST match — these go over Socket.IO and are
 * validated server-side with Zod. If you rename one side, rename both.
 */

export interface PresenceEntry {
  userId: string;
  name?: string;
  joinedAt: number;
}

export interface PresenceMessage {
  room: string;
  present: PresenceEntry[];
}

export interface ChatMessage {
  room: string;
  userId: string;
  name?: string;
  text: string;
  at: number;
}

export interface CursorMessage {
  room: string;
  userId: string;
  x: number;
  y: number;
}

export interface SystemError {
  error: string;
}

export type ServerToClientEvents = {
  presence: (payload: PresenceMessage) => void;
  chat: (payload: ChatMessage) => void;
  cursor: (payload: CursorMessage) => void;
  'system.error': (payload: SystemError) => void;
  'auth.required': () => void;
};

export type ClientToServerEvents = {
  'room.join': (payload: { room: string }, ack?: (ok: boolean) => void) => void;
  'room.leave': (payload: { room: string }) => void;
  chat: (payload: { room: string; text: string }, ack?: (ok: boolean) => void) => void;
  cursor: (payload: { room: string; x: number; y: number }) => void;
};

/** Client-side mirror of the backend's room-name regex. */
export const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
