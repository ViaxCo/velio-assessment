import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgres://velio:velio@localhost:5433/velio_test",
      INVITE_HOLDOUT_PERCENT: "0",
    },
    globalSetup: "test/reset-db.ts",
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
