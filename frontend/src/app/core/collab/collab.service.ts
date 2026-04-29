import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
  Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, fromEvent } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

import { AuthService } from '../auth/auth.service';
import {
  ChatMessage,
  ClientToServerEvents,
  CursorMessage,
  PresenceEntry,
  PresenceMessage,
  ServerToClientEvents,
  SystemError,
} from './protocol';

export type ConnectionState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'connected'; socketId: string; rttMs: number | null }
  | { kind: 'reconnecting'; attempt: number }
  | { kind: 'disconnected'; reason: string }
  | { kind: 'error'; message: string };

interface ConnectOptions {
  room: string;
  name: string;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * The single owner of the Socket.IO client. Components subscribe to its
 * signals and observable streams; they never touch the socket directly.
 *
 * Design notes:
 * - State that drives the UI shape (connection, presence, current room) is
 *   exposed as Angular signals so OnPush components re-render automatically.
 * - High-volume event streams (cursor, chat) are exposed as RxJS Subjects so
 *   consumers can throttle/buffer/transform with operators without forcing
 *   every event through change detection.
 * - The service is provided in `root`, but a room component owns the
 *   lifetime via `connect()` / `disconnect()`. This keeps the service
 *   simple and matches Angular's "service-per-feature, scoped lifetime"
 *   pattern.
 */
@Injectable({ providedIn: 'root' })
export class CollabService {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private socket: TypedSocket | null = null;
  private rttTimer: ReturnType<typeof setInterval> | null = null;
  private currentRoom: string | null = null;

  /** Observable streams — for high-frequency events. */
  private readonly chat$ = new Subject<ChatMessage>();
  private readonly cursor$ = new Subject<CursorMessage>();
  private readonly systemError$ = new Subject<SystemError>();

  readonly chatMessages = this.chat$.asObservable();
  readonly cursorMoves = this.cursor$.asObservable();
  readonly systemErrors = this.systemError$.asObservable();

  /** Reactive state — for shape-driving UI. */
  readonly connection = signal<ConnectionState>({ kind: 'idle' });
  readonly presence = signal<PresenceEntry[]>([]);
  readonly room = signal<string | null>(null);
  readonly userId = signal<string | null>(null);

  readonly isConnected: Signal<boolean> = computed(() => this.connection().kind === 'connected');
  readonly presenceCount: Signal<number> = computed(() => this.presence().length);

  async connect({ room, name }: ConnectOptions): Promise<void> {
    if (this.socket) this.teardownSocket('reconnect');

    this.connection.set({ kind: 'connecting' });
    const token = await this.auth.getToken(name);
    this.userId.set(name);
    this.currentRoom = room;
    this.room.set(room);

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    }) as TypedSocket;
    this.socket = socket;

    socket.on('connect', () => {
      this.connection.set({ kind: 'connected', socketId: socket.id ?? '?', rttMs: null });
      socket.emit('room.join', { room });
      this.startRttPolling(socket);
    });

    socket.on('disconnect', (reason) => {
      this.connection.set({ kind: 'disconnected', reason: String(reason) });
      this.stopRttPolling();
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      this.connection.set({ kind: 'reconnecting', attempt });
    });

    socket.on('connect_error', (err) => {
      this.connection.set({ kind: 'error', message: err.message || 'connect_error' });
    });

    socket.on('presence', (msg: PresenceMessage) => {
      if (msg.room === this.currentRoom) this.presence.set(msg.present);
    });

    socket.on('chat', (msg: ChatMessage) => {
      if (msg.room === this.currentRoom) this.chat$.next(msg);
    });

    socket.on('cursor', (msg: CursorMessage) => {
      if (msg.room === this.currentRoom && msg.userId !== this.userId()) {
        this.cursor$.next(msg);
      }
    });

    socket.on('system.error', (err: SystemError) => this.systemError$.next(err));
    socket.on('auth.required', () =>
      this.connection.set({ kind: 'error', message: 'auth required — token rejected' }),
    );

    fromEvent(window, 'beforeunload')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.teardownSocket('beforeunload'));
  }

  sendChat(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || !this.socket || !this.currentRoom) return false;
    if (trimmed.length > 2000) return false;
    this.socket.emit('chat', { room: this.currentRoom, text: trimmed });
    return true;
  }

  sendCursor(x: number, y: number): void {
    if (!this.socket || !this.currentRoom) return;
    this.socket.volatile.emit('cursor', { room: this.currentRoom, x, y });
  }

  disconnect(): void {
    this.teardownSocket('manual');
    this.connection.set({ kind: 'idle' });
    this.presence.set([]);
    this.room.set(null);
    this.currentRoom = null;
  }

  private teardownSocket(reason: string): void {
    this.stopRttPolling();
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {
        /* noop — best-effort cleanup */
      }
      this.socket = null;
    }
    if (reason === 'beforeunload') {
      this.connection.set({ kind: 'disconnected', reason });
    }
  }

  private startRttPolling(socket: TypedSocket): void {
    this.stopRttPolling();
    const measure = (): void => {
      const start = performance.now();
      socket.volatile.emit('cursor', {
        room: this.currentRoom ?? '',
        x: -1,
        y: -1,
      });
      const elapsed = performance.now() - start;
      const conn = this.connection();
      if (conn.kind === 'connected') {
        this.connection.set({ ...conn, rttMs: Math.round(elapsed) });
      }
    };
    this.rttTimer = setInterval(measure, 5_000);
  }

  private stopRttPolling(): void {
    if (this.rttTimer) {
      clearInterval(this.rttTimer);
      this.rttTimer = null;
    }
  }
}
