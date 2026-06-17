import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

/**
 * Database component — tested wherever a database is present. One item is testable
 * over HTTP (a connection string / credentials must never ship to the client), the
 * rest are "invisible" (indexes, migrations, backups, row-level security, pooling)
 * and are declared BLOCKED with guidance to connect the Supabase/PlanetScale MCP
 * server to verify them. Honest — never a faked pass.
 */
const DB_EVIDENCE = /(postgres|postgresql|mysql|mariadb|sqlite|mongo|supabase|planetscale|prisma|drizzle|sequelize|typeorm|knex|neon)/;
const DB_ENV = /(DATABASE_URL|POSTGRES_URL|MYSQL_URL|MONGODB_URI|SUPABASE|PLANETSCALE|NEON|PG)/;

export function databasePresent(scan: RepoScan | null, hints: AuditHints): boolean {
  const evidence = [scan?.repo_summary?.framework ?? "", ...(scan?.detail?.framework_evidence ?? [])].join(" ").toLowerCase();
  const env = (scan?.repo_summary?.env_keys_present ?? []).join(" ").toUpperCase();
  return DB_EVIDENCE.test(evidence) || DB_ENV.test(env) || Boolean((hints as { database?: unknown }).database);
}

export function generateDatabase(scan: RepoScan | null, _crawl: RuntimeCrawl, hints: AuditHints, c: Counter): GeneratedCard[] {
  if (!databasePresent(scan, hints)) return [];
  const cards: GeneratedCard[] = [];

  cards.push({
    id: c.next("TC-DB"), title: "No database connection string or credentials shipped to the client", category: "secrets_exposure", status: "ready", risk: "critical",
    goal: "A connection string (postgres://, mysql://, mongodb+srv://) or DB credentials must never appear in the page/client bundle — that hands an attacker your database.",
    steps: ["GET /", "Confirm the page/bundle contains no DB connection string or credentials"], expectedEvidence: ["http_transcript"], dataNeeds: [],
    acceptanceCriteria: "Home page / client bundle has no postgres://, mysql://, mongodb+srv:// or DATABASE_URL with embedded credentials. OWASP secrets exposure.",
    exec: [{ action: "http", method: "GET", path: "/", expectBodyExcludesCI: ["postgres://", "postgresql://", "mysql://", "mongodb+srv://", "mongodb://", "@db.", "password=", "DATABASE_URL"] }],
  });

  const invisible: Array<[string, string, string]> = [
    ["Indexes back the hot queries", "the columns used in WHERE/JOIN/ORDER BY on busy tables are indexed (no seq scans at scale)", "connect the Supabase/PlanetScale MCP and inspect indexes"],
    ["Migrations are applied and in order", "every migration is applied to production and the schema matches the migration history", "run the migration status via the DB MCP / your ORM"],
    ["Automated backups are configured", "point-in-time recovery / scheduled backups are on and tested", "confirm in the DB provider console or via the MCP"],
    ["Row-level security / access control", "RLS (or equivalent app-layer scoping) restricts each row to its owner/tenant", "inspect RLS policies via the Supabase MCP"],
    ["Connection pooling is configured", "a pooler (PgBouncer/Supabase pooler/PlanetScale) prevents connection exhaustion under load", "verify the pooled connection string + max connections"],
  ];
  for (const [title, crit, how] of invisible) {
    cards.push({
      id: c.next("TC-DB"), title, category: "integration_side_effects", status: "blocked", risk: "high",
      goal: "An invisible database property a web-URL audit cannot see directly.",
      steps: [how, "Re-run with the DB MCP connected"], expectedEvidence: ["db introspection"], dataNeeds: ["a Supabase/PlanetScale MCP connection or DB credentials"],
      acceptanceCriteria: `BLOCKED: ${crit} — verify via the database MCP (not reachable from an HTTP audit).`, exec: [],
    });
  }
  return cards;
}
