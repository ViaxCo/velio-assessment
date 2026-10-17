import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { config } from "../src/config.ts";
import { createDb } from "../src/db.ts";
import { createLive } from "../src/live.ts";

export async function startServers(count: number) {
  const db = createDb(config.databaseUrl);
  const instances = await Promise.all(
    Array.from({ length: count }, async () => {
      const instanceDb = createDb(config.databaseUrl);
      const live = createLive(config.redisUrl);
      await live.ready;
      const server = createApp(instanceDb, live).listen(0);
      await new Promise((resolve) => server.once("listening", resolve));
      const url = `http://localhost:${(server.address() as AddressInfo).port}`;
      const stop = async () => {
        await live.close();
        server.close();
        await instanceDb.destroy();
      };
      return { url, stop };
    }),
  );

  const request = async (url: string, path: string, init: { method?: string; userId?: string; body?: unknown } = {}) => {
    const res = await fetch(url + path, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...(init.userId && { "x-user-id": init.userId }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };

  const createUser = async (name: string) => {
    const id = randomUUID();
    await request(instances[0].url, `/users/${id}`, { method: "PUT", body: { name } });
    return id;
  };

  const createActivity = async (hostId: string, capacity: number) => {
    const { body } = await request(instances[0].url, "/activities", {
      method: "POST",
      userId: hostId,
      body: {
        title: "Sunset Kayaking",
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        priceMinor: 1_500_000,
        capacity,
      },
    });
    return body.id as string;
  };

  return {
    db,
    urls: instances.map((instance) => instance.url),
    request,
    createUser,
    createActivity,
    async stop() {
      await Promise.all(instances.map((instance) => instance.stop()));
      await db.destroy();
    },
  };
}
