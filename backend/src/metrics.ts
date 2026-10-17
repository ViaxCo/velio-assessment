import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const bookingAttempts = new client.Counter({
  name: "velio_booking_attempts_total",
  help: "Booking and claim attempts by outcome",
  labelNames: ["source", "outcome"] as const,
  registers: [registry],
});

export const availabilityLatency = new client.Summary({
  name: "velio_availability_update_seconds",
  help: "Time from a booking commit to the update being written to each open client",
  percentiles: [0.5, 0.95, 0.99],
  maxAgeSeconds: 600,
  ageBuckets: 5,
  registers: [registry],
});

export const openStreams = new client.Gauge({
  name: "velio_open_streams",
  help: "Open availability streams on this instance",
  registers: [registry],
});
