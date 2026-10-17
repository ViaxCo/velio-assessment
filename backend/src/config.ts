export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://velio:velio@localhost:5433/velio",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  invitesEnabled: process.env.INVITES_ENABLED !== "false",
  inviteHoldoutPercent: Number(process.env.INVITE_HOLDOUT_PERCENT ?? 10),
};
