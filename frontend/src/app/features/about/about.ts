import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HealthService } from '../../core/health/health.service';

@Component({
  selector: 'nc-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  private readonly health = inject(HealthService);
  readonly snap = this.health.latest;
}
