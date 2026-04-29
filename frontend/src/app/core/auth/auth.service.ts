import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface DevTokenResponse {
  token: string;
}

/**
 * Talks to the backend's `/dev/token` endpoint (gated behind DEMO_MODE).
 * In a real deployment this would be replaced with an OAuth/OIDC flow —
 * the contract a caller cares about is `getToken(name)` returning a JWT.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly displayName = signal<string>(this.restoreName());
  readonly lastError = signal<string | null>(null);

  async getToken(name: string): Promise<string> {
    this.lastError.set(null);
    const params = new URLSearchParams({ sub: name, name });
    try {
      const response = await firstValueFrom(
        this.http.get<DevTokenResponse>(`/dev/token?${params.toString()}`),
      );
      this.persistName(name);
      this.displayName.set(name);
      return response.token;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'token endpoint failed (is DEMO_MODE on?)';
      this.lastError.set(message);
      throw err;
    }
  }

  setDisplayName(name: string): void {
    this.persistName(name);
    this.displayName.set(name);
  }

  private restoreName(): string {
    if (typeof window === 'undefined') return this.randomName();
    return window.localStorage.getItem('nc.name') ?? this.randomName();
  }

  private persistName(name: string): void {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nc.name', name);
    }
  }

  private randomName(): string {
    return `user-${Math.random().toString(36).slice(2, 6)}`;
  }
}
