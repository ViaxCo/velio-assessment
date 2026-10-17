import knex from "knex";
import pg from "pg";

pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const camelizeRow = (row: unknown) =>
  row && typeof row === "object" && !Array.isArray(row)
    ? Object.fromEntries(Object.entries(row).map(([key, value]) => [toCamel(key), value]))
    : row;

export function createDb(url: string) {
  return knex({
    client: "pg",
    connection: url,
    pool: { min: 0, max: 20 },
    migrations: {
      directory: new URL("../migrations", import.meta.url).pathname,
      loadExtensions: [".ts"],
    },
    postProcessResponse: (result) => (Array.isArray(result) ? result.map(camelizeRow) : camelizeRow(result)),
  });
}

export type Db = ReturnType<typeof createDb>;
