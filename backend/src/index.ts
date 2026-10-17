import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { createDb } from "./db.ts";
import { createLive } from "./live.ts";

const db = createDb(config.databaseUrl);
await db.migrate.latest();
const live = createLive(config.redisUrl);
await live.ready;

const server = createApp(db, live).listen(config.port, () => {
  console.log(`Velio API on http://localhost:${config.port}`);
});

process.on("SIGTERM", async () => {
  await live.close();
  server.close();
  await db.destroy();
});
