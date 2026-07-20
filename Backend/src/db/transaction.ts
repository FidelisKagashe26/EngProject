import type { PoolClient } from "pg";
import { db } from "./pool";

/**
 * Minimal shape shared by `Pool` and `PoolClient` so services can run either
 * against the pool directly or inside an open transaction.
 */
export type Queryable = {
  query: <T = unknown>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

/**
 * Runs `fn` inside a single database transaction, committing on success and
 * rolling back on any thrown error. Every write that touches project financial
 * totals must go through here so a partial failure can never leave a
 * transaction row without its matching project-total movement.
 */
export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    // A failed ROLLBACK means the connection is already unusable; the original
    // error is the one worth surfacing.
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};
