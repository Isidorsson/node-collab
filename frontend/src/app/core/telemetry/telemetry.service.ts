import { Injectable, computed, inject, signal } from '@angular/core';

import { CollabService } from '../collab/collab.service';
import { HealthService } from '../health/health.service';

export interface TelemetryFrame {
  label: string;
  value: string;
  tone: 'neutral' | 'accent' | 'cool' | 'warn';
}

/**
 * Aggregates the live signals that should appear in the "telemetry tape" — a
 * single pill that travels along the top of the shell. Pure derivation;
 * no I/O of its own.
 */
@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly collab = inject(CollabService);
  private readonly health = inject(HealthService);

  private readonly chatRate = signal(0);
  private readonly chatCount = signal(0);

  readonly frames = computed<TelemetryFrame[]>(() => {
    const conn = this.collab.connection();
    const snap = this.health.latest();
    const presence = this.collab.presenceCount();
    const room = this.collab.room();

    return [
      {
        label: 'instance',
        value: snap?.instance ?? '—',
        tone: 'cool',
      },
      {
        label: 'mode',
        value: snap?.mode ?? '—',
        tone: snap?.mode === 'redis' ? 'accent' : 'neutral',
      },
      {
        label: 'socket',
        value: this.connectionLabel(conn),
        tone:
          conn.kind === 'connected' ? 'accent' : conn.kind === 'error' ? 'warn' : 'neutral',
      },
      {
        label: 'rtt',
        value:
          conn.kind === 'connected' && conn.rttMs != null ? `${conn.rttMs}ms` : '—',
        tone: 'neutral',
      },
      {
        label: 'room',
        value: room ?? 'lobby',
        tone: 'cool',
      },
      {
        label: 'present',
        value: String(presence).padStart(2, '0'),
        tone: presence > 0 ? 'accent' : 'neutral',
      },
      {
        label: 'msg/min',
        value: this.chatRate().toFixed(1),
        tone: 'neutral',
      },
    ];
  });

  /** Called by the Room feature whenever a chat message arrives. */
  noteChatArrival(): void {
    this.chatCount.update((n) => n + 1);
  }

  /** Called periodically (every 10s) by the shell to sample the rate. */
  sampleRate(windowSeconds: number): void {
    const count = this.chatCount();
    this.chatCount.set(0);
    this.chatRate.set((count * 60) / windowSeconds);
  }

  private connectionLabel(conn: ReturnType<CollabService['connection']>): string {
    switch (conn.kind) {
      case 'idle':
        return 'idle';
      case 'connecting':
        return 'opening';
      case 'connected':
        return 'open';
      case 'reconnecting':
        return `retry·${conn.attempt}`;
      case 'disconnected':
        return 'closed';
      case 'error':
        return 'error';
    }
  }
}
