import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PresenceEntry } from '../../../core/collab/protocol';

@Component({
  selector: 'nc-presence-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './presence-list.html',
  styleUrl: './presence-list.css',
})
export class PresenceList {
  readonly entries = input.required<PresenceEntry[]>();
  readonly meId = input.required<string | null>();

  readonly sorted = computed(() => {
    const list = [...this.entries()];
    const me = this.meId();
    list.sort((a, b) => {
      if (me) {
        if (a.userId === me) return -1;
        if (b.userId === me) return 1;
      }
      return a.joinedAt - b.joinedAt;
    });
    return list;
  });

  /** Stable color hash so each user gets a recognizable hue. */
  hue(userId: string): number {
    let h = 0;
    for (let i = 0; i < userId.length; i += 1) {
      h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  joinedAgo(joinedAt: number): string {
    const seconds = Math.max(0, Math.floor((Date.now() - joinedAt) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  }
}
