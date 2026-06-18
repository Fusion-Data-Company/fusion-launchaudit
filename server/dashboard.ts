/**
 * 80/20 Launch Audit — the local hub.
 *
 * Boots the dashboard on an embedded, on-disk Postgres (PGlite) so every audit
 * persists and is recalled across sessions, then opens it in the browser. No
 * cloud, no signup — the data never leaves the machine. This is the user's home
 * base: paste the install command, run `npm run dashboard`, and it's live.
 */
import os from "node:os";
import path from "node:path";

if (!process.env.POSTGRES_URL && !process.env.LAUNCHAUDIT_LOCAL_DB) {
  process.env.LAUNCHAUDIT_LOCAL_DB = path.join(os.homedir(), ".launchaudit", "db");
}
process.env.LAUNCHAUDIT_OPEN = process.env.LAUNCHAUDIT_OPEN ?? "1";

await import("./dev-server.ts");
