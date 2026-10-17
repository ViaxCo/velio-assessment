import type { Knex } from "knex";
import type { Db } from "./db.ts";
import { AppError, isUniqueViolation } from "./errors.ts";
import type { Live } from "./live.ts";
import { bookingAttempts } from "./metrics.ts";
import { inviteGroup } from "./users.ts";

const inviteUsed = () => new AppError(410, "invite_used", "This personal invite has already been used.");

async function noSpotError(trx: Knex.Transaction, activityId: string) {
  const activity = await trx("activities").where({ id: activityId }).first();
  if (!activity) return new AppError(404, "not_found", "This activity doesn't exist.");
  if (activity.startsAt <= new Date()) return new AppError(410, "activity_started", "This activity has already started.");
  return new AppError(409, "sold_out", "Someone just took the last spot. This activity is full.");
}

async function reserveSpot(trx: Knex.Transaction, activityId: string, userId: string, planId: string | null) {
  const [activity] = await trx("activities")
    .where({ id: activityId })
    .where("spots_taken", "<", trx.ref("capacity"))
    .where("starts_at", ">", trx.fn.now())
    .update({ spots_taken: trx.raw("spots_taken + 1"), version: trx.raw("version + 1") })
    .returning(["id", "spots_taken", "capacity", "version"]);
  if (!activity) throw await noSpotError(trx, activityId);

  const plan = planId ?? (await trx("plans").insert({ activity_id: activityId, created_by: userId }).returning("id"))[0].id;
  const [booking] = await trx("bookings")
    .insert({ activity_id: activityId, plan_id: plan, user_id: userId })
    .returning("*");
  return { activity, booking };
}

async function takeSpot(
  db: Db,
  live: Live,
  source: "book" | "claim",
  { activityId, userId }: { activityId: string; userId: string },
  work: (trx: Knex.Transaction) => ReturnType<typeof reserveSpot>,
) {
  const record = (outcome: string) => bookingAttempts.inc({ source, outcome });

  try {
    const { activity, booking } = await db.transaction(work);
    record("success");
    void live.publish({
      activityId: activity.id,
      spotsTaken: activity.spotsTaken,
      capacity: activity.capacity,
      version: activity.version,
      committedAt: Date.now(),
    });
    return { booking, created: true };
  } catch (error) {
    const booking = await db("bookings")
      .where({ activity_id: activityId, user_id: userId })
      .first()
      .catch(() => undefined);
    if (booking) {
      record("already_booked");
      return { booking, created: false };
    }
    const failure = isUniqueViolation(error, "attributions_vouch_once") ? inviteUsed() : error;
    record(failure instanceof AppError ? failure.code : "error");
    throw failure;
  }
}

export function bookSpot(db: Db, live: Live, activityId: string, userId: string) {
  return takeSpot(db, live, "book", { activityId, userId }, async (trx) => {
    const spot = await reserveSpot(trx, activityId, userId, null);
    await trx("events").insert({
      name: "booked",
      actor_id: userId,
      activity_id: activityId,
      props: { planId: spot.booking.planId },
    });
    return spot;
  });
}

export async function claimSpot(db: Db, live: Live, code: string, userId: string, name: string) {
  const invite = await db("invites").where({ code }).first();
  if (!invite) throw new AppError(404, "invite_not_found", "We couldn't find that invite code.");
  if (invite.inviterId === userId) throw new AppError(400, "own_invite", "This is your own invite. Share it with a friend.");

  return takeSpot(db, live, "claim", { activityId: invite.activityId, userId }, async (trx) => {
    if (invite.rail === "vouch" && (await trx("attributions").where({ invite_id: invite.id }).first())) {
      throw inviteUsed();
    }

    const inviter = await trx("users").where({ id: invite.inviterId }).first();
    const generation = inviter.generation + 1;
    const [newUser] = await trx("users")
      .insert({ id: userId, name, generation, invite_group: inviteGroup(userId) })
      .onConflict("id")
      .ignore()
      .returning("id");
    const isNewUser = Boolean(newUser);

    const spot = await reserveSpot(trx, invite.activityId, userId, invite.planId);
    await trx("attributions").insert({
      invite_id: invite.id,
      inviter_id: invite.inviterId,
      invitee_id: userId,
      rail: invite.rail,
      code,
      generation,
      is_new_user: isNewUser,
      booking_id: spot.booking.id,
    });
    await trx("events").insert({
      name: "spot_claimed",
      actor_id: userId,
      activity_id: invite.activityId,
      invite_id: invite.id,
      rail: invite.rail,
      props: { generation, isNewUser },
    });
    return spot;
  });
}
