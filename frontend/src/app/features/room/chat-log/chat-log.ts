import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CollabService } from '../../../core/collab/collab.service';
import { TelemetryService } from '../../../core/telemetry/telemetry.service';
import { ChatMessage } from '../../../core/collab/protocol';

interface DisplayedMessage extends ChatMessage {
  /** Stable hue per author for visual continuity with the cursor canvas. */
  hue: number;
  /** Whether this message is by the local user (right-aligned). */
  mine: boolean;
}

const MAX_HISTORY = 200;

@Component({
  selector: 'nc-chat-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-log.html',
  styleUrl: './chat-log.css',
})
export class ChatLog implements AfterViewChecked {
  private readonly collab = inject(CollabService);
  private readonly telemetry = inject(TelemetryService);

  readonly meId = input.required<string | null>();

  readonly messages = signal<DisplayedMessage[]>([]);
  readonly logEl = viewChild<ElementRef<HTMLElement>>('log');

  private shouldScroll = false;

  constructor() {
    this.collab.chatMessages.pipe(takeUntilDestroyed()).subscribe((msg) => {
      this.append(msg);
      this.telemetry.noteChatArrival();
    });

    /* When a new message lands, mark "needs scroll" — actual scroll happens
       in afterViewChecked once the DOM has the new row. */
    effect(() => {
      this.messages();
      this.shouldScroll = true;
    });
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScroll) return;
    this.shouldScroll = false;
    const el = this.logEl()?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  formatTime(at: number): string {
    const d = new Date(at);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private append(msg: ChatMessage): void {
    const me = this.meId();
    const enriched: DisplayedMessage = {
      ...msg,
      hue: hashHue(msg.userId),
      mine: msg.userId === me,
    };
    const next = [...this.messages(), enriched];
    if (next.length > MAX_HISTORY) next.splice(0, next.length - MAX_HISTORY);
    this.messages.set(next);
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
