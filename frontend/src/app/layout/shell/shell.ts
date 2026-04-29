import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { ThemeService } from '../../core/theme/theme.service';
import { TelemetryTape } from '../telemetry-tape/telemetry-tape';

@Component({
  selector: 'nc-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TelemetryTape],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly themeSvc = inject(ThemeService);

  readonly theme = this.themeSvc.theme;

  toggleTheme(): void {
    this.themeSvc.toggle();
  }

  /** Build timestamp for the rail footer — purely cosmetic, but it grounds the
   *  "operations console" feeling and makes the page feel live. */
  readonly bootedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
}
