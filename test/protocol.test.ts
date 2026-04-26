import { describe, it, expect } from 'vitest';
import { ChatPayload, CursorPayload, JoinPayload, RoomName } from '../src/io/protocol.js';

describe('protocol schemas', () => {
  it('accepts valid room names', () => {
    expect(RoomName.safeParse('lobby').success).toBe(true);
    expect(RoomName.safeParse('design-2026').success).toBe(true);
    expect(RoomName.safeParse('a_b_c').success).toBe(true);
  });

  it('rejects invalid room names', () => {
    expect(RoomName.safeParse('').success).toBe(false);
    expect(RoomName.safeParse('has spaces').success).toBe(false);
    expect(RoomName.safeParse('a/b').success).toBe(false);
    expect(RoomName.safeParse('x'.repeat(100)).success).toBe(false);
  });

  it('chat payload caps length at 2000', () => {
    expect(ChatPayload.safeParse({ room: 'r', text: 'x'.repeat(2000) }).success).toBe(true);
    expect(ChatPayload.safeParse({ room: 'r', text: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('cursor payload requires finite numbers', () => {
    expect(CursorPayload.safeParse({ room: 'r', x: 10, y: 20 }).success).toBe(true);
    expect(CursorPayload.safeParse({ room: 'r', x: Infinity, y: 0 }).success).toBe(false);
    expect(CursorPayload.safeParse({ room: 'r', x: NaN, y: 0 }).success).toBe(false);
  });

  it('join payload requires a room', () => {
    expect(JoinPayload.safeParse({}).success).toBe(false);
    expect(JoinPayload.safeParse({ room: 'lobby' }).success).toBe(true);
  });
});
