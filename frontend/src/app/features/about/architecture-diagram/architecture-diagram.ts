import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'nc-architecture-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './architecture-diagram.svg.html',
  styleUrl: './architecture-diagram.css',
})
export class ArchitectureDiagram {}
