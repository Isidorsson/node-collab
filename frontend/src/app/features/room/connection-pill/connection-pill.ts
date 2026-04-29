import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ConnectionState } from '../../../core/collab/collab.service';

@Component({
  selector: 'nc-connection-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="pill" [attr.data-state]="state().kind">
      <span class="pill__dot" aria-hidden="true"></span>
      <span class="pill__text">{{ label() }}</span>
    </span>
  `,
  styleUrl: './connection-pill.css',
})
export class ConnectionPill {
  readonly state = input.required<ConnectionState>();

  readonly label = computed(() => {
    const s = this.state();
    switch (s.kind) {
      case 'idle':
        return 'idle';
      case 'connecting':
        return 'opening socket';
      case 'connected':
        return 'channel open';
      case 'reconnecting':
        return `reconnect · attempt ${s.attempt}`;
      case 'disconnected':
        return `closed · ${s.reason}`;
      case 'error':
        return `error · ${s.message}`;
    }
  });
}
