export type SqlClient = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

let cachedClient: SqlClient | null = null;

export function postgresConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.POSTGRES_URL);
}

export async function getSqlClient(
  env: Record<string, string | undefined> = process.env,
): Promise<SqlClient | null> {
  if (!env.POSTGRES_URL) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

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
