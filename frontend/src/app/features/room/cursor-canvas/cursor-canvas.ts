import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CollabService } from '../../../core/collab/collab.service';
import { CursorMessage } from '../../../core/collab/protocol';
import { CursorThrottle } from './cursor-throttle';

interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
  hue: number;
  lastSeen: number;
}

@Component({
  selector: 'nc-cursor-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cursor-canvas.html',
  styleUrl: './cursor-canvas.css',
})
export class CursorCanvas implements OnInit, OnDestroy {
  private readonly collab = inject(CollabService);
  private readonly destroyRef = inject(DestroyRef);

  readonly board = viewChild<ElementRef<HTMLDivElement>>('board');
  readonly cursors = signal<RemoteCursor[]>([]);
  private cursorMap = new Map<string, RemoteCursor>();

  private throttle: CursorThrottle | null = null;
  private staleSweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.collab.cursorMoves
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => this.applyRemoteMove(msg));
  }

  ngOnInit(): void {
    this.throttle = new CursorThrottle({
      maxHz: 60,
      onSend: (x, y) => this.collab.sendCursor(x, y),
    });

    /* Drop cursors that have not moved in 4s — peer probably disconnected
       between presence updates, or moved out of viewport. */
    this.staleSweepTimer = setInterval(() => this.sweepStale(), 1500);
  }

  ngOnDestroy(): void {
    this.throttle?.dispose();
    if (this.staleSweepTimer) clearInterval(this.staleSweepTimer);
  }

  onPointerMove(event: PointerEvent): void {
    const board = this.board()?.nativeElement;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.throttle?.feed(x, y);
  }

  private applyRemoteMove(msg: CursorMessage): void {
    /* The RTT-probe emits cursors with x=-1, y=-1 as a heartbeat — ignore
       those for rendering. */
    if (msg.x < 0 || msg.y < 0) return;

    const existing = this.cursorMap.get(msg.userId);
    if (existing) {
      existing.x = msg.x;
      existing.y = msg.y;
      existing.lastSeen = performance.now();
    } else {
      this.cursorMap.set(msg.userId, {
        userId: msg.userId,
        x: msg.x,
        y: msg.y,
        hue: hashHue(msg.userId),
        lastSeen: performance.now(),
      });
    }
    this.cursors.set([...this.cursorMap.values()]);
  }

  private sweepStale(): void {
    const cutoff = performance.now() - 4000;
    let dropped = false;
    for (const [id, c] of this.cursorMap) {
      if (c.lastSeen < cutoff) {
        this.cursorMap.delete(id);
        dropped = true;
      }
    }
    if (dropped) this.cursors.set([...this.cursorMap.values()]);
  }
}

function hashHue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i += 1) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}
