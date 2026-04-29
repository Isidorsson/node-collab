# node-collab

Express + Socket.IO + Redis pub/sub real-time service, with an Angular 20 frontend that consumes it. **Node twin of [collab-board](../../GoLang/collab-board)** — same problem domain, deliberately so. The point is to show I solved this problem in two ecosystems and to compare the trade-offs.

## What it does

A multi-room collaborative app: shared cursors + chat with live presence, served as an Angular 20 single-page app from the same Express process that hosts the Socket.IO endpoint. Two operating modes:

- **Redis mode** (when `REDIS_URL` is set): multiple replicas share traffic via the Socket.IO Redis adapter — a message published on instance A is delivered to clients connected to instance B. Presence is stored in Redis hashes with TTL.
- **Memory mode** (when `REDIS_URL` is unset): single-instance only, in-memory presence. Useful for local dev and minimal deployments. Detected automatically — `/healthz` reports the active mode.

| Concern | collab-board (Go) | node-collab (Node) |
|---|---|---|
| Concurrency primitive | Goroutine-per-room (single writer) | Socket.IO event loop + Redis adapter |
| Backpressure | Bounded channel + non-blocking TrySend | `volatile.emit` + transport-stalled watcher |
| Slow-client policy | Eviction after queue overflow | Eviction after stalled-transport timeout |
| Cross-instance fanout | n/a (single process) | Redis pub/sub |
| Auth | none (demo) | JWT handshake via `io.use()` |

## Endpoints / events

| Direction | Event | Payload |
|---|---|---|
| C→S | `room.join` | `{ room: string }` |
| C→S | `room.leave` | `{ room: string }` |
| C→S | `chat` | `{ room, text }` (≤2000 chars, validated) |
| C→S | `cursor` | `{ room, x, y }` (sent volatile) |
| S→C | `presence` | `{ room, present: PresenceEntry[] }` |
| S→C | `chat` | `{ room, userId, name, text, at }` |
| S→C | `cursor` | `{ room, userId, x, y }` |

HTTP:

- `GET /healthz` — JSON, includes `instance` (so you can verify which replica served you)
- `GET /metrics` — Prometheus text format
- `GET /dev/token?sub=…&name=…` — dev-only, mints a JWT (disabled in production)

## Repo layout

```
node-collab/
├── src/                  # Express + Socket.IO + Redis backend
├── frontend/             # Angular 20 SPA (standalone components, signals)
│   └── src/app/
│       ├── core/         # AuthService, HealthService, CollabService, ThemeService, TelemetryService
│       ├── layout/       # Shell + telemetry-tape signature element
│       └── features/     # home (lobby), room (canvas+chat+presence), about (architecture)
├── public/browser/       # build artifact: Angular bundle (gitignored)
└── Dockerfile            # multi-stage: frontend → backend → runtime
```

The Angular app lives at the same origin as the API (no CORS), shares the
wire-protocol type definitions with the backend (`src/io/protocol.ts` ↔
`frontend/src/app/core/collab/protocol.ts`), and is built into
`public/browser/` — Express serves the bundle and falls back to `index.html`
for any unknown SPA route.

## Local dev — two processes

```bash
docker compose up -d redis
cp .env.example .env

# terminal 1 — backend on :3001
npm install
npm run dev

# terminal 2 — Angular dev server on :4200, proxies /socket.io + /dev/* + /healthz
npm run dev:frontend
```

Open `http://localhost:4200/` and pick a room (or jump straight to
`http://localhost:4200/r/observatory`). Open a second tab — move the mouse,
type a message — both tabs see each other live.

## Local dev — single process

```bash
docker compose up -d redis
npm run build:frontend     # emits public/browser/*
npm run dev                # http://localhost:3001 — serves SPA + API
```

## Local dev — two replicas (the headline demo)

```bash
npm run build:frontend          # build the SPA once
docker compose up               # redis + node-a + node-b
```

- `http://localhost:3001/` is served by `instance-a`
- `http://localhost:3002/` is served by `instance-b`

Open both. Each browser connects to a different replica — visible in the SPA's "telemetry tape" header. Send a chat message — it travels through Redis and lands on the other replica's clients. Check `/healthz` on each port to confirm the `instance` field differs.

## Load test

The `bench/load.ts` script spawns "fast" clients (read every message) and "slow" clients (deliberately ignore messages) — the slow ones exercise the slow-client watcher.

```bash
tsx bench/load.ts --url=http://localhost:3001 --fast=20 --slow=5 --duration=15
curl http://localhost:3001/metrics | grep collab_
```

You should see `collab_slow_client_evictions_total` increment for the slow clients.

## Deploy to Railway

1. Push to GitHub.
2. New Railway project → "Deploy from GitHub" → pick the repo.
3. Add the **Redis** plugin → `REDIS_URL` is set automatically.
4. Set `JWT_SECRET` (use `openssl rand -hex 32`).
5. In the service settings: set **replica count = 2** (or more) and enable **session affinity / sticky sessions** so a given WebSocket stays on the same replica. The Redis adapter handles cross-replica fanout regardless.

`railway.json` already pins `numReplicas: 2`.

## Architecture

```
                 ┌──────────── instance A ────────────┐
client A ────────│  Socket.IO  ←──── handlers ────────│──┐
                 │      ↑                              │  │
                 │      └── Redis adapter (pub/sub) ───│──┤
                 └─────────────────────────────────────┘  │
                                                       Redis
                 ┌──────────── instance B ────────────┐  │
client B ────────│  Socket.IO  ←──── handlers ────────│──┘
                 └─────────────────────────────────────┘
```

`registerSocketHandlers` is a pure function of `(io, redis, env, logger)` — no globals. Tests can construct one in isolation; production wires it once at boot.

## Where to extend

Four TODO blocks mark the design decisions worth experimenting with:

- `src/io/auth.ts` — what to do when a JWT expires mid-session (force-disconnect vs grace-period refresh)
- `src/io/slow_client.ts` — how to detect slow clients (transport-stalled vs ack-timeout)
- `src/obs/metrics.ts` — already has reasonable defaults, but you may want per-room cardinality once you understand your traffic shape
- `frontend/src/app/features/room/cursor-canvas/cursor-throttle.ts` — outbound cursor emit cadence (rAF vs time-based vs hybrid). Trades smoothness for backend pressure.

## License

MIT
