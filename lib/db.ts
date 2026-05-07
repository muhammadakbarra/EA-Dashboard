import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DB_URL;

if (!connectionString) {
  throw new Error("DB_URL is not set");
}

declare global {
  var __eaDashboardPool: Pool | undefined;
}

const pool = global.__eaDashboardPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  global.__eaDashboardPool = pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
