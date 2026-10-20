import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServers } from "./servers.ts";

describe("invites and attribution", () => {
  let servers: Awaited<ReturnType<typeof startServers>>;
  let url: string;

  beforeAll(async () => {
    servers = await startServers(2);
    url = servers.urls[0];
  });

  afterAll(() => servers.stop());

  const book = async (activityId: string, userId: string) =>
    servers.request(url, `/activities/${activityId}/bookings`, { method: "POST", userId });

  const invite = async (activityId: string, userId: string, body: object) =>
    (await servers.request(url, `/activities/${activityId}/invites`, { method: "POST", userId, body })).body;

  const claim = (code: string, userId: string, i = 0) =>
    servers.request(servers.urls[i % servers.urls.length], `/invites/${code}/claim`, {
      method: "POST",
      body: { userId, name: "Guest" },
    });

  it("records who invited whom, on which rail, and how many hops from the first user", async () => {
    const host = await servers.createUser("Host");
    const activityId = await servers.createActivity(host, 10);
    const booker = await servers.createUser("Booker");
    const booking = (await book(activityId, booker)).body;

    const vouch = await invite(activityId, booker, { rail: "vouch", recipient: "Ngozi" });
    const guest = randomUUID();
    expect((await claim(vouch.code, guest)).status).toBe(201);

    const share = await invite(activityId, guest, { rail: "public" });
    const secondGuest = randomUUID();
    expect((await claim(share.code.toLowerCase(), secondGuest)).status).toBe(201);

    const attributions = await servers.db("attributions").where({ inviter_id: booker }).orWhere({ inviter_id: guest });
    expect(attributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inviteeId: guest, rail: "vouch", code: vouch.code, generation: 1, isNewUser: true }),
        expect.objectContaining({ inviteeId: secondGuest, rail: "public", code: share.code, generation: 2 }),
      ]),
    );

    const users = await servers.db("users").whereIn("id", [guest, secondGuest]).orderBy("generation");
    expect(users.map((user) => user.generation)).toEqual([1, 2]);

    const plan = await servers.db("bookings").where({ plan_id: booking.planId });
    expect(plan.map((member) => member.userId).sort()).toEqual([booker, guest, secondGuest].sort());
  });

  it("gives each person one public link per activity", async () => {
    const host = await servers.createUser("Host");
    const activityId = await servers.createActivity(host, 10);

    const first = await invite(activityId, host, { rail: "public" });
    const second = await invite(activityId, host, { rail: "public" });
    const vouch = await invite(activityId, host, { rail: "vouch", recipient: "Ada" });

    expect(second.code).toBe(first.code);
    expect(vouch.code).not.toBe(first.code);
    expect(await servers.db("events").where({ name: "invite_created", activity_id: activityId, rail: "public" })).toHaveLength(1);
  });

  it("lets a vouch invite be claimed only once, even when claims race", async () => {
    const host = await servers.createUser("Host");
    const activityId = await servers.createActivity(host, 20);
    const vouch = await invite(activityId, host, { rail: "vouch", recipient: "Tunde" });

    const guests = Array.from({ length: 10 }, () => randomUUID());
    const results = await Promise.all(guests.map((guest, i) => claim(vouch.code, guest, i)));

    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.body.error === "invite_used")).toHaveLength(9);
    const activity = await servers.db("activities").where({ id: activityId }).first();
    expect(activity.spotsTaken).toBe(1);
    expect(await servers.db("users").whereIn("id", guests)).toHaveLength(1);

    const winner = guests[results.findIndex((result) => result.status === 201)];
    const seenBy = async (userId: string) => (await servers.request(url, `/invites/${vouch.code}`, { userId })).body;
    expect(await seenBy(winner)).toMatchObject({ used: true, joined: true });
    expect(await seenBy(guests.find((guest) => guest !== winner)!)).toMatchObject({ used: true, joined: false });
    expect((await claim(vouch.code, winner)).status).toBe(200);
  });

  it("keeps attribution and events append-only", async () => {
    await expect(servers.db("attributions").update({ rail: "public" })).rejects.toThrow(/append-only/);
    await expect(servers.db("attributions").delete()).rejects.toThrow(/append-only/);
    await expect(servers.db("events").update({ name: "booked" })).rejects.toThrow(/append-only/);
  });

  it("does not let holdout users create invites", async () => {
    const host = await servers.createUser("Host");
    const activityId = await servers.createActivity(host, 5);
    await servers.db("users").where({ id: host }).update({ invite_group: "holdout" });

    const result = await servers.request(url, `/activities/${activityId}/invites`, {
      method: "POST",
      userId: host,
      body: { rail: "public" },
    });
    expect(result).toMatchObject({ status: 403, body: { error: "invites_disabled" } });
  });
});
