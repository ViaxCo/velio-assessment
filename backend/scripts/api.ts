import { randomUUID } from "node:crypto";

export const API_URL = process.env.API_URL ?? "http://localhost:4000";

export async function call(path: string, init: { method?: string; userId?: string; body?: unknown } = {}) {
  const res = await fetch(API_URL + path, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...(init.userId && { "x-user-id": init.userId }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: await res.json() };
}

export async function createUser(name: string) {
  const id = randomUUID();
  await call(`/users/${id}`, { method: "PUT", body: { name } });
  return id;
}

export async function createActivity(hostId: string, activity: { title: string; description?: string; capacity: number; priceMinor: number; daysAhead: number }) {
  const { body } = await call("/activities", {
    method: "POST",
    userId: hostId,
    body: {
      title: activity.title,
      description: activity.description,
      capacity: activity.capacity,
      priceMinor: activity.priceMinor,
      startsAt: new Date(Date.now() + activity.daysAhead * 86_400_000).toISOString(),
    },
  });
  return body.id as string;
}
