import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { CollabService } from '../../core/collab/collab.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROOM_NAME_PATTERN } from '../../core/collab/protocol';

import { CursorCanvas } from './cursor-canvas/cursor-canvas';
import { ChatLog } from './chat-log/chat-log';
import { ChatComposer } from './chat-composer/chat-composer';
import { PresenceList } from './presence-list/presence-list';
import { ConnectionPill } from './connection-pill/connection-pill';

@Component({
  selector: 'nc-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CursorCanvas, ChatLog, ChatComposer, PresenceList, ConnectionPill],
  templateUrl: './room.html',
  styleUrl: './room.css',
})
export class Room implements OnInit, OnDestroy {
  private readonly collab = inject(CollabService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Provided automatically by withComponentInputBinding(). */
  readonly room = input.required<string>();

  readonly connection = this.collab.connection;
  readonly presence = this.collab.presence;
  readonly userId = this.collab.userId;
  readonly initError = signal<string | null>(null);

  readonly isReady = computed(() => this.connection().kind === 'connected');

  async ngOnInit(): Promise<void> {
    const room = this.room();
    if (!ROOM_NAME_PATTERN.test(room)) {
      void this.router.navigate(['/']);
      return;
    }
    try {
      await this.collab.connect({ room, name: this.auth.displayName() });
    } catch (err) {
      this.initError.set(
        err instanceof Error ? err.message : 'failed to open the channel — see console',
      );
    }
  }

  ngOnDestroy(): void {
    this.collab.disconnect();
  }

  leave(): void {
    void this.router.navigate(['/']);
  }
}
