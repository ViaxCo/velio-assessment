import { createDb } from "../src/db.ts";

export default async function resetDb() {
  const db = createDb("postgres://velio:velio@localhost:5433/velio_test");
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.destroy();
}
