import { createHash } from "node:crypto";
import { config } from "./config.ts";

export type User = {
  id: string;
  name: string;
  generation: number;
  inviteGroup: "treatment" | "holdout";
  createdAt: Date;
};

export function inviteGroup(userId: string): User["inviteGroup"] {
  const bucket = createHash("sha256").update(userId).digest().readUInt32BE(0) % 100;
  return bucket < config.inviteHoldoutPercent ? "holdout" : "treatment";
}

export const invitesEnabled = (user: User) => config.invitesEnabled && user.inviteGroup === "treatment";

export const userView = (user: User) => ({ ...user, invitesEnabled: invitesEnabled(user) });
