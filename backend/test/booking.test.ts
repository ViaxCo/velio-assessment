import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServers } from "./servers.ts";

describe("booking the last spots", () => {
  let servers: Awaited<ReturnType<typeof startServers>>;

  beforeAll(async () => {
    servers = await startServers(2);
  });

  afterAll(() => servers.stop());

  it("never oversells when many people book at the same moment", async () => {
    const capacity = 5;
    const host = await servers.createUser("Host");
    const activityId = await servers.createActivity(host, capacity);
    const bookers = await Promise.all(Array.from({ length: 60 }, (_, i) => servers.createUser(`Booker ${i}`)));

    const results = await Promise.all(
      bookers.map((userId, i) =>
        servers.request(servers.urls[i % servers.urls.length], `/activities/${activityId}/bookings`, {
          method: "POST",
          userId,
        }),
      ),
    );

    const created = results.filter((result) => result.status === 201);
    const soldOut = results.filter((result) => result.status === 409);
    expect(created).toHaveLength(capacity);
    expect(soldOut).toHaveLength(bookers.length - capacity);
    expect(soldOut.every((result) => result.body.error === "sold_out")).toBe(true);

    const activity = await servers.db("activities").where({ id: activityId }).first();
    const bookings = await servers.db("bookings").where({ activity_id: activityId });
    expect(activity.spotsTaken).toBe(capacity);
    expect(bookings).toHaveLength(capacity);
    expect(new Set(bookings.map((booking) => booking.userId))).toEqual(
      new Set(created.map((result) => result.body.userId)),
    );
    expect(await servers.db("check_oversold")).toEqual([]);
  });

  it("books one spot when the same person taps the last spot many times at once", async () => {
    const host = await servers.createUser("Host");
    const activityId = await servers.createActivity(host, 1);
    const userId = await servers.createUser("Double tapper");

    const results = await Promise.all(
      servers.urls.flatMap((url) =>
        Array.from({ length: 5 }, () =>
          servers.request(url, `/activities/${activityId}/bookings`, { method: "POST", userId }),
        ),
      ),
    );

    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.every((result) => result.status === 201 || result.status === 200)).toBe(true);
    expect(new Set(results.map((result) => result.body.id)).size).toBe(1);
    const activity = await servers.db("activities").where({ id: activityId }).first();
    expect(activity.spotsTaken).toBe(1);
  });
});
