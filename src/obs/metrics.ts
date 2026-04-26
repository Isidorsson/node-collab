import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const activeSockets = new Gauge({
  name: 'collab_active_sockets',
  help: 'Currently connected sockets on this instance',
  labelNames: ['instance'] as const,
  registers: [registry],
});

export const activeRooms = new Gauge({
  name: 'collab_active_rooms',
  help: 'Rooms with at least one local socket',
  labelNames: ['instance'] as const,
  registers: [registry],
});

export const messagesPublished = new Counter({
  name: 'collab_messages_published_total',
  help: 'Messages this instance has published (across all clients/rooms)',
  labelNames: ['instance', 'channel'] as const,
  registers: [registry],
});

export const messagesDelivered = new Counter({
  name: 'collab_messages_delivered_total',
  help: 'Messages this instance has delivered to local sockets',
  labelNames: ['instance', 'channel'] as const,
  registers: [registry],
});

export const slowClientEvictions = new Counter({
  name: 'collab_slow_client_evictions_total',
  help: 'Sockets disconnected for failing to keep up with the send rate',
  labelNames: ['instance', 'reason'] as const,
  registers: [registry],
});
