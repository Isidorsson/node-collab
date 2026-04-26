/**
 * Load-test harness for node-collab. Spins up N "fast" clients and M "slow"
 * clients against a target instance and reports throughput + eviction counts.
 *
 * Usage:
 *   tsx bench/load.ts --url=http://localhost:3001 --fast=20 --slow=5 --duration=15
 *
 * The "slow" clients deliberately stop reading after the first message — this
 * exercises the slow-client policy in src/io/slow_client.ts. After `duration`
 * seconds, the script prints a summary you can compare to /metrics.
 */
import { io as ioClient, type Socket } from 'socket.io-client';
import { signDevToken } from '../src/io/auth.js';
import { loadEnv } from '../src/config/env.js';

interface Args {
  url: string;
  fast: number;
  slow: number;
  duration: number;
  room: string;
}

function parseArgs(): Args {
  const out: Args = {
    url: 'http://localhost:3001',
    fast: 10,
    slow: 2,
    duration: 10,
    room: 'load-test',
  };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--(\w+)=(.+)$/);
    if (!m) continue;
    const k = m[1];
    const v = m[2];
    if (!k || v === undefined) continue;
    if (k === 'url' || k === 'room') out[k] = v;
    else if (k === 'fast' || k === 'slow' || k === 'duration') out[k] = Number(v);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = loadEnv();

  const fastClients: Socket[] = [];
  const slowClients: Socket[] = [];

  const counters = { sent: 0, received: 0, errors: 0 };

  const make = (label: string, slow: boolean): Socket => {
    const sub = `${label}-${Math.random().toString(36).slice(2, 8)}`;
    const token = signDevToken(env, sub, sub);
    const socket = ioClient(args.url, { auth: { token }, transports: ['websocket'] });

    socket.on('connect', () => socket.emit('room.join', { room: args.room }));
    socket.on('connect_error', () => counters.errors++);

    if (!slow) {
      socket.on('chat', () => counters.received++);
    }
    return socket;
  };

  for (let i = 0; i < args.fast; i++) fastClients.push(make('fast', false));
  for (let i = 0; i < args.slow; i++) slowClients.push(make('slow', true));

  process.stdout.write(`spawned ${args.fast} fast + ${args.slow} slow clients\n`);

  // Fast clients send chat at ~5 msg/sec each.
  const sender = setInterval(() => {
    for (const s of fastClients) {
      if (s.connected) {
        s.emit('chat', { room: args.room, text: `tick-${counters.sent}` });
        counters.sent++;
      }
    }
  }, 200);

  setTimeout(() => {
    clearInterval(sender);
    process.stdout.write(`\n--- summary (after ${args.duration}s) ---\n`);
    process.stdout.write(`sent:     ${counters.sent}\n`);
    process.stdout.write(`received: ${counters.received} (across ${args.fast} fast clients)\n`);
    process.stdout.write(`errors:   ${counters.errors}\n`);
    process.stdout.write(`hint: curl ${args.url}/metrics | grep collab_\n`);
    for (const s of [...fastClients, ...slowClients]) s.disconnect();
    setTimeout(() => process.exit(0), 200);
  }, args.duration * 1000);
}

main().catch((err: unknown) => {
  process.stderr.write(`load-test failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
