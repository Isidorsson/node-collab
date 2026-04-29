/**
 * Outbound cursor-emit throttle.
 *
 * 🟡 LEARNING-MODE TODO 🟡 — this is the meaningful design decision in the
 * cursor pipeline. The Room component calls `throttle.feed(x, y)` on every
 * `mousemove`. Your job is to decide which calls actually fire `onSend`.
 *
 * Trade-off you're making:
 *   - Higher rate (≈ 60 Hz): silky cursors, but every replica + every peer
 *     processes more events. Backend slow-client watcher will evict clients
 *     whose transport falls behind.
 *   - Lower rate (≈ 15 Hz): kinder to the network and to slow clients, but
 *     cursor motion looks "steppy."
 *   - Coalesce-by-frame (`requestAnimationFrame`): emits at the display's
 *     refresh rate. Almost always the right answer, but allocates a frame
 *     handle per move.
 *
 * Constraints:
 *   - Only the LAST position queued in a window matters — older positions are
 *     stale by the time they arrive.
 *   - If a movement stops, the final resting position MUST be sent (otherwise
 *     other peers see a phantom cursor frozen mid-motion).
 *   - The function should be allocation-light on the hot path; do not create
 *     closures inside `feed()`.
 *
 * Suggested approaches:
 *   1. Plain time-based: track `lastSentAt`, drop samples until `intervalMs`
 *      elapses, then schedule a `setTimeout` to flush the last point.
 *   2. rAF-based: queue one rAF; on the rAF tick send the latest point and
 *      reset the queue.
 *   3. Hybrid: rAF, plus a min-interval clamp so we never emit faster than
 *      the backend cares about.
 *
 * Pick one. Aim for ~5-15 lines inside `feed()` + any small private fields.
 */

export interface CursorThrottleOptions {
  /** Suggested upper-bound emit rate in Hertz. Used by your implementation. */
  maxHz: number;
  /** Called when a coordinate should actually be sent over the wire. */
  onSend: (x: number, y: number) => void;
}

export class CursorThrottle {
  private readonly intervalMs: number;
  private readonly onSend: (x: number, y: number) => void;

  // ---- private fields you may use in your implementation ----
  private rafHandle: number | null = null;
  private trailingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingX = 0;
  private pendingY = 0;
  private hasPending = false;
  private lastSentAt = 0;

  constructor(opts: CursorThrottleOptions) {
    this.intervalMs = Math.max(1000 / opts.maxHz, 1);
    this.onSend = opts.onSend;
  }

  /**
   * Called on every pointer/mouse move with the latest coords. Decide here
   * whether to emit now, schedule, or coalesce. The trailing-edge contract
   * (final position must be delivered) is your responsibility.
   */
  feed(x: number, y: number): void {
    // 🟡 IMPLEMENT ME 🟡 — see header comment for guidance.
    // The bare-minimum (no throttling) version below is here so the app
    // boots while you decide. Replace it.
    this.onSend(x, y);
    this.pendingX = x;
    this.pendingY = y;
    this.hasPending = false;
    this.lastSentAt = performance.now();
  }

  /** Cancel any pending emits. Called on disconnect / room change. */
  dispose(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.trailingTimer !== null) {
      clearTimeout(this.trailingTimer);
      this.trailingTimer = null;
    }
    this.hasPending = false;
  }
}
