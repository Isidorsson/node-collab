import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.restore());

  constructor() {
    effect(() => {
      const t = this.theme();
      if (typeof document !== 'undefined') {
        document.documentElement.dataset['theme'] = t;
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nc.theme', t);
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private restore(): Theme {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem('nc.theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
