import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HealthService } from '../../core/health/health.service';
import { ArchitectureDiagram } from './architecture-diagram/architecture-diagram';

@Component({
  selector: 'nc-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArchitectureDiagram],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  private readonly health = inject(HealthService);
  readonly snap = this.health.latest;
}
