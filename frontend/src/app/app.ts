import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Shell } from './layout/shell/shell';
import { HealthService } from './core/health/health.service';
import { TelemetryService } from './core/telemetry/telemetry.service';

@Component({
  selector: 'nc-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Shell],
  template: `
    <nc-shell>
      <router-outlet />
    </nc-shell>
  `,
})
export class App implements OnInit {
  private readonly health = inject(HealthService);
  private readonly telemetry = inject(TelemetryService);

  async ngOnInit(): Promise<void> {
    await this.health.refresh();
    setInterval(() => void this.health.refresh(), 30_000);
    setInterval(() => this.telemetry.sampleRate(10), 10_000);
  }
}
