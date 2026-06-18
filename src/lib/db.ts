export type SqlClient = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

let cachedClient: SqlClient | null = null;

export function postgresConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.POSTGRES_URL || env.LAUNCHAUDIT_LOCAL_DB);
}

export async function getSqlClient(
  env: Record<string, string | undefined> = process.env,
): Promise<SqlClient | null> {
  if (cachedClient) {
    return cachedClient;
  }

  // Cloud Postgres (Neon) when configured.
  if (env.POSTGRES_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(env.POSTGRES_URL);
    cachedClient = async (text: string, params: unknown[] = []) => {
      const result = await sql.query(text, params as never[]);
      if (Array.isArray(result)) {
        return result as Record<string, unknown>[];
      }
      return ((result as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];
    };
    return cachedClient;
  }

  // Local hub: embedded, on-disk Postgres (PGlite). Persistent across sessions,
  // no cloud, no native build — the user's data never leaves their machine.
  if (env.LAUNCHAUDIT_LOCAL_DB) {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(env.LAUNCHAUDIT_LOCAL_DB);
    const ready = (pg as { waitReady?: Promise<unknown> }).waitReady;
    if (ready) await ready;
    cachedClient = async (text: string, params: unknown[] = []) => {
      const result = await pg.query(text, params as unknown[]);
      return ((result as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];
    };
    return cachedClient;
  }

  return null;
}
