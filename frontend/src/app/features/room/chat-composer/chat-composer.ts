import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CollabService } from '../../../core/collab/collab.service';

@Component({
  selector: 'nc-chat-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './chat-composer.html',
  styleUrl: './chat-composer.css',
})
export class ChatComposer {
  private readonly collab = inject(CollabService);

  readonly draft = signal('');
  readonly remaining = signal(2000);

  onInput(value: string): void {
    this.draft.set(value);
    this.remaining.set(Math.max(0, 2000 - value.length));
  }

  onEnter(event: Event): void {
    event.preventDefault();
    this.send();
  }

  send(): void {
    const text = this.draft();
    if (!text.trim()) return;
    if (this.collab.sendChat(text)) {
      this.draft.set('');
      this.remaining.set(2000);
    }
  }
}
