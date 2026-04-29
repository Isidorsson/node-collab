import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TelemetryService } from '../../core/telemetry/telemetry.service';

@Component({
  selector: 'nc-telemetry-tape',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './telemetry-tape.html',
  styleUrl: './telemetry-tape.css',
})
export class TelemetryTape {
  private readonly telemetry = inject(TelemetryService);

  readonly frames = this.telemetry.frames;
}
