import cors from "cors";
import express, { type ErrorRequestHandler, type Request } from "express";
import { z } from "zod";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import { createInvite, findInvite } from "./invites.ts";
import type { Live } from "./live.ts";
import { registry } from "./metrics.ts";
import { bookSpot, claimSpot } from "./spots.ts";
import { readStats } from "./stats.ts";
import { inviteGroup, userView, type User } from "./users.ts";

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, "invalid", z.prettifyError(result.error));
  return result.data;
}

const uuid = z.uuid();
const name = z.string().trim().min(1).max(60);
const platform = z.enum(["web", "ios", "android"]);

const newActivity = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(1000).default(""),
  startsAt: z.iso.datetime({ offset: true }).refine((value) => new Date(value) > new Date(), "must be in the future"),
  priceMinor: z.number().int().min(0),
  capacity: z.number().int().min(1).max(1000),
});

const newInvite = z.discriminatedUnion("rail", [
  z.object({ rail: z.literal("vouch"), recipient: z.string().trim().min(1).max(80) }),
  z.object({ rail: z.literal("public") }),
]);

const trackedEvent = z.discriminatedUnion("name", [
  z.object({ name: z.literal("activity_viewed"), actorId: uuid, activityId: uuid, platform }),
  z.object({ name: z.literal("invite_opened"), actorId: uuid, code: z.string(), platform }),
]);

export function createApp(db: Db, live: Live) {
  const app = express();
  app.use(cors(), express.json());

  const activities = () =>
    db("activities")
      .join("users", "users.id", "activities.host_id")
      .select("activities.*", "users.name as host_name", db.raw("capacity - spots_taken as spots_left"));

  async function findActivity(id: string) {
    const activity = uuid.safeParse(id).success ? await activities().where("activities.id", id).first() : undefined;
    if (!activity) throw new AppError(404, "not_found", "This activity doesn't exist.");
    return activity;
  }

  const userIdHeader = (req: Request) => {
    const id = req.header("x-user-id");
    return id && uuid.safeParse(id).success ? id : null;
  };

  async function currentUser(req: Request): Promise<User> {
    const id = userIdHeader(req);
    const user = id ? await db("users").where({ id }).first() : undefined;
    if (!user) throw new AppError(401, "unknown_user", "Tell us your name first.");
    return user;
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.put("/users/:id", async (req, res) => {
    const id = parse(uuid, req.params.id);
    const body = parse(z.object({ name }), req.body);
    const [user] = await db("users")
      .insert({ id, name: body.name, invite_group: inviteGroup(id) })
      .onConflict("id")
      .merge(["name"])
      .returning("*");
    res.json(userView(user));
  });

  app.get("/users/:id", async (req, res) => {
    const user = await db("users").where({ id: parse(uuid, req.params.id) }).first();
    if (!user) throw new AppError(404, "not_found", "We don't know this user yet.");
    res.json(userView(user));
  });

  app.get("/activities", async (req, res) => {
    const booked = db.raw(
      "exists (select 1 from bookings where bookings.activity_id = activities.id and bookings.user_id = ?) as booked",
      [userIdHeader(req)],
    );
    res.json(await activities().select(booked).where("starts_at", ">", db.fn.now()).orderBy("starts_at"));
  });

  app.post("/activities", async (req, res) => {
    const host = await currentUser(req);
    const body = parse(newActivity, req.body);
    const [{ id }] = await db("activities")
      .insert({
        host_id: host.id,
        title: body.title,
        description: body.description,
        starts_at: body.startsAt,
        price_minor: body.priceMinor,
        capacity: body.capacity,
      })
      .returning("id");
    res.status(201).json(await findActivity(id));
  });

  app.get("/activities/:id", async (req, res) => {
    const activity = await findActivity(req.params.id);
    const attendees = await db("bookings")
      .join("users", "users.id", "bookings.user_id")
      .leftJoin("attributions", "attributions.booking_id", "bookings.id")
      .where("bookings.activity_id", activity.id)
      .orderBy("bookings.created_at")
      .select("bookings.user_id", "users.name", "bookings.plan_id", "attributions.rail", "bookings.created_at");
    res.json({ ...activity, attendees });
  });

  app.post("/activities/:id/bookings", async (req, res) => {
    const user = await currentUser(req);
    const { booking, created } = await bookSpot(db, live, parse(uuid, req.params.id), user.id);
    res.status(created ? 201 : 200).json(booking);
  });

  app.post("/activities/:id/invites", async (req, res) => {
    const user = await currentUser(req);
    const invite = await createInvite(db, user, parse(uuid, req.params.id), parse(newInvite, req.body));
    res.status(201).json(invite);
  });

  app.get("/invites/:code", async (req, res) => {
    const invite = await findInvite(db, req.params.code.toUpperCase());
    const userId = userIdHeader(req);
    const joined = Boolean(userId && (await db("bookings").where({ activity_id: invite.activityId, user_id: userId }).first()));
    res.json({ ...invite, joined, activity: await findActivity(invite.activityId) });
  });

  app.post("/invites/:code/claim", async (req, res) => {
    const body = parse(z.object({ userId: uuid, name }), req.body);
    const { booking, created } = await claimSpot(db, live, req.params.code.toUpperCase(), body.userId, body.name);
    res.status(created ? 201 : 200).json(booking);
  });

  app.post("/events", async (req, res) => {
    const event = parse(trackedEvent, req.body);
    const invite = event.name === "invite_opened" ? await findInvite(db, event.code.toUpperCase()) : undefined;
    const activity = await findActivity(event.name === "invite_opened" ? invite.activityId : event.activityId);
    await db("events").insert({
      name: event.name,
      actor_id: event.actorId,
      activity_id: activity.id,
      invite_id: invite?.id,
      rail: invite?.rail,
      props: { platform: event.platform, spotsLeft: activity.spotsLeft },
    });
    res.status(204).end();
  });

  app.get("/stream", (req, res) => {
    const activityId = typeof req.query.activityId === "string" ? req.query.activityId : undefined;
    live.open(res, activityId);
  });

  app.get("/metrics", async (_req, res) => {
    res.type(registry.contentType).send(await registry.metrics());
  });

  app.get("/stats", async (_req, res) => {
    res.json(await readStats(db));
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json({ error: error.code, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server_error", message: "Something went wrong on our side. Please try again." });
  };
  app.use(handleError);

  return app;
}
