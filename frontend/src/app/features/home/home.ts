import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { ROOM_NAME_PATTERN } from '../../core/collab/protocol';

interface SuggestedRoom {
  id: string;
  blurb: string;
  badge: string;
}

@Component({
  selector: 'nc-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly nameDraft = signal(this.auth.displayName());
  readonly roomDraft = signal('observatory');
  readonly errorMsg = signal<string | null>(null);

  readonly canEnter = computed(() => {
    const room = this.roomDraft().trim();
    const name = this.nameDraft().trim();
    return ROOM_NAME_PATTERN.test(room) && name.length > 0;
  });

  readonly suggested: SuggestedRoom[] = [
    { id: 'observatory', blurb: 'house demo · always live', badge: '01' },
    { id: 'lobby', blurb: 'low-traffic baseline', badge: '02' },
    { id: 'stress-test', blurb: 'point load benches here', badge: '03' },
    { id: 'sandbox', blurb: 'feel free to make a mess', badge: '04' },
  ];

  enter(): void {
    const room = this.roomDraft().trim();
    const name = this.nameDraft().trim();
    if (!ROOM_NAME_PATTERN.test(room)) {
      this.errorMsg.set('room name must match [a-zA-Z0-9_-]{1,64}');
      return;
    }
    if (!name) {
      this.errorMsg.set('display name is required');
      return;
    }
    this.auth.setDisplayName(name);
    void this.router.navigate(['/r', room]);
  }

  pickSuggested(id: string): void {
    this.roomDraft.set(id);
  }
}
