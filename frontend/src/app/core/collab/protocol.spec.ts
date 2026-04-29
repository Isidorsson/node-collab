import { ROOM_NAME_PATTERN } from './protocol';

/**
 * The frontend's room-name regex must accept exactly the same strings as the
 * backend's Zod schema (`src/io/protocol.ts`'s RoomName). If these diverge,
 * users get a confusing "valid in the form, invalid on the wire" failure.
 */
describe('ROOM_NAME_PATTERN', () => {
  it('accepts plain words', () => {
    expect(ROOM_NAME_PATTERN.test('lobby')).toBe(true);
    expect(ROOM_NAME_PATTERN.test('observatory')).toBe(true);
  });

  it('accepts hyphens, underscores, and digits', () => {
    expect(ROOM_NAME_PATTERN.test('design-2026')).toBe(true);
    expect(ROOM_NAME_PATTERN.test('a_b_c')).toBe(true);
    expect(ROOM_NAME_PATTERN.test('room-42')).toBe(true);
  });

  it('rejects spaces, slashes, and other punctuation', () => {
    expect(ROOM_NAME_PATTERN.test('has spaces')).toBe(false);
    expect(ROOM_NAME_PATTERN.test('a/b')).toBe(false);
    expect(ROOM_NAME_PATTERN.test('hi.there')).toBe(false);
    expect(ROOM_NAME_PATTERN.test('@me')).toBe(false);
  });

  it('rejects empty and oversize names', () => {
    expect(ROOM_NAME_PATTERN.test('')).toBe(false);
    expect(ROOM_NAME_PATTERN.test('x'.repeat(65))).toBe(false);
  });
});
