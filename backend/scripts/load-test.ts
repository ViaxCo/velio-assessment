import { call, createActivity, createUser, API_URL } from "./api.ts";

const CAPACITY = 200;
const BOOKERS = 300;
const LISTENERS = 50;
const CONCURRENCY = 50;

async function listen(activityId: string, latencies: number[], signal: AbortSignal) {
  const res = await fetch(`${API_URL}/stream?activityId=${activityId}`, { signal });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      const messages = buffer.split("\n\n");
      buffer = messages.pop()!;
      for (const message of messages) {
        if (!message.startsWith("data: ")) continue;
        latencies.push(Date.now() - JSON.parse(message.slice(6)).committedAt);
      }
    }
  } catch {
    return;
  }
}

async function inPool<T, R>(items: T[], size: number, run: (item: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) results.push(await run(items[next++]));
    }),
  );
  return results;
}

const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor((p / 100) * values.length))];

const host = await createUser("Load test host");
const activityId = await createActivity(host, { title: "Load test", capacity: CAPACITY, priceMinor: 0, daysAhead: 1 });
const bookers = await inPool(Array.from({ length: BOOKERS }, (_, i) => i), CONCURRENCY, (i) => createUser(`Booker ${i}`));

const latencies: number[] = [];
const streams = new AbortController();
const listening = Array.from({ length: LISTENERS }, () => listen(activityId, latencies, streams.signal));
await new Promise((resolve) => setTimeout(resolve, 500));

const started = Date.now();
const results = await inPool(bookers, CONCURRENCY, (userId) =>
  call(`/activities/${activityId}/bookings`, { method: "POST", userId }),
);
const seconds = (Date.now() - started) / 1000;
await new Promise((resolve) => setTimeout(resolve, 1000));
streams.abort();
await Promise.all(listening);

const created = results.filter((result) => result.status === 201).length;
const soldOut = results.filter((result) => result.body.error === "sold_out").length;
const errors = results.length - created - soldOut;
const activity = (await call(`/activities/${activityId}`)).body;
const oversold = activity.attendees.length > CAPACITY || activity.attendees.length !== activity.spotsTaken;
const successPct = (100 * created) / (created + errors);
const p95 = percentile(latencies, 95);
const expectedUpdates = created * LISTENERS;

console.log(`${BOOKERS} bookers, ${CAPACITY} spots, ${CONCURRENCY} at a time, ${LISTENERS} open clients, ${seconds.toFixed(1)}s`);
console.log(`Booked ${created}, sold out ${soldOut}, errors ${errors}`);
console.log(`Updates received ${latencies.length}, expected ${expectedUpdates}`);
console.table([
  { slo: "Zero oversold bookings", target: "0", actual: oversold ? "OVERSOLD" : "0", met: !oversold },
  { slo: "Bookings succeed when spots exist", target: ">= 99.5%", actual: `${successPct.toFixed(2)}%`, met: successPct >= 99.5 },
  {
    slo: "Availability update p95",
    target: "<= 2000 ms, every update delivered",
    actual: `${p95} ms (p50 ${percentile(latencies, 50)} ms), ${latencies.length} of ${expectedUpdates}`,
    met: p95 <= 2000 && latencies.length === expectedUpdates,
  },
]);
