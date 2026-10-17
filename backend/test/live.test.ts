import { afterAll, beforeAll, expect, it } from "vitest";
import { startServers } from "./servers.ts";

let servers: Awaited<ReturnType<typeof startServers>>;

beforeAll(async () => {
  servers = await startServers(2);
});

afterAll(() => servers.stop());

async function firstEvent(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value } = await reader.read();
    buffer += value;
    const match = buffer.match(/^data: (.+)$/m);
    if (match) {
      await reader.cancel();
      return JSON.parse(match[1]);
    }
  }
}

it("pushes availability to clients connected to a different server instance", async () => {
  const host = await servers.createUser("Host");
  const activityId = await servers.createActivity(host, 4);
  const booker = await servers.createUser("Booker");

  const event = firstEvent(`${servers.urls[1]}/stream?activityId=${activityId}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await servers.request(servers.urls[0], `/activities/${activityId}/bookings`, { method: "POST", userId: booker });

  expect(await event).toMatchObject({ activityId, spotsTaken: 1, capacity: 4, version: 1 });
});
