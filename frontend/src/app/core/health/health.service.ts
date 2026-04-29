import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface HealthSnapshot {
  status: 'ok' | 'degraded' | 'unknown';
  service: string;
  instance: string;
  mode: 'redis' | 'memory';
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  readonly latest = signal<HealthSnapshot | null>(null);

  async refresh(): Promise<HealthSnapshot> {
    try {
      const snap = await firstValueFrom(this.http.get<HealthSnapshot>('/healthz'));
      this.latest.set(snap);
      return snap;
    } catch {
      const fallback: HealthSnapshot = {
        status: 'unknown',
        service: 'node-collab',
        instance: '?',
        mode: 'memory',
      };
      this.latest.set(fallback);
      return fallback;
    }
  }
}
