import { randomInt } from "node:crypto";
import { config } from "./config.ts";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import { invitesEnabled, type User } from "./users.ts";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

export async function createInvite(
  db: Db,
  user: User,
  activityId: string,
  { rail, recipient }: { rail: "vouch" | "public"; recipient?: string },
) {
  if (!invitesEnabled(user)) throw new AppError(403, "invites_disabled", "Invites aren't available for you yet.");

  const activity = await db("activities").where({ id: activityId }).first();
  if (!activity) throw new AppError(404, "not_found", "This activity doesn't exist.");
  if (activity.startsAt <= new Date()) throw new AppError(410, "activity_started", "This activity has already started.");

  const booking = await db("bookings").where({ activity_id: activityId, user_id: user.id }).first();
  if (!booking && activity.hostId !== user.id) {
    throw new AppError(403, "not_in_activity", "Book a spot first, then invite your friends.");
  }

  const withUrl = <T extends { code: string }>(invite: T) => ({ ...invite, url: `${config.webUrl}/i/${invite.code}` });

  if (rail === "public") {
    const existing = await db("invites").where({ inviter_id: user.id, activity_id: activityId, rail }).first();
    if (existing) return withUrl(existing);
  }

  return db.transaction(async (trx) => {
    const [invite] = await trx("invites")
      .insert({
        code: newCode(),
        rail,
        inviter_id: user.id,
        activity_id: activityId,
        plan_id: booking?.planId ?? null,
        recipient: rail === "vouch" ? recipient : null,
      })
      .returning("*");
    await trx("events").insert({
      name: "invite_created",
      actor_id: user.id,
      activity_id: activityId,
      invite_id: invite.id,
      rail,
    });
    return withUrl(invite);
  });
}

export async function findInvite(db: Db, code: string) {
  const invite = await db("invites")
    .join("users", "users.id", "invites.inviter_id")
    .where({ code })
    .first("invites.*", "users.name as inviter_name");
  if (!invite) throw new AppError(404, "invite_not_found", "We couldn't find that invite code.");

  const used = invite.rail === "vouch" && Boolean(await db("attributions").where({ invite_id: invite.id }).first());
  return { ...invite, used };
}
