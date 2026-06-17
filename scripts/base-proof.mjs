import { auditVerifyHttp } from "../runner/verify.ts";
import { scanCompleteness } from "../src/lib/completeness/scan.ts";
import fs from "node:fs/promises";

const appUrl = "http://127.0.0.1:4400";
const card = (id, title, cat, risk, exec, acc) => ({ id, title, category: cat, status: "ready", risk, goal: "", steps: [], expectedEvidence: [], dataNeeds: [], acceptanceCriteria: acc, exec });
const cards = [
  card("ADM-admin", "Admin page blocks anonymous", "roles_permissions", "critical", [{ action: "http", path: "/admin", expectBlocked: true }], "anon GET /admin is blocked"),
  card("API-health", "Health endpoint responds", "api_contract", "low", [{ action: "http", path: "/api/health", expectStatusOneOf: [200] }], "/api/health returns 200"),
  card("ADM-idor", "Admin detail blocks anonymous (IDOR)", "roles_permissions", "critical", [{ action: "http", path: "/admin/users/42", expectBlocked: true }], "anon GET /admin/users/42 is blocked"),
  card("ADM-delete", "Admin delete API blocks anonymous", "roles_permissions", "critical", [{ action: "http", method: "POST", path: "/api/admin/delete-user", expectBlocked: true }], "anon POST delete-user is blocked"),
];
const out = await auditVerifyHttp(cards, { appUrl, artifactDir: "/tmp/base-proof-art" });
console.log("\n=== VERDICTS (truth protocol + watchdog) ===");
for (const v of out.verdicts) console.log(`${v.status.toUpperCase().padEnd(18)} conf=${String(v.confidence).padEnd(6)} watchdog=${v.watchdog?.verified}  ${v.checkId} — ${v.reason.slice(0, 64)}`);
console.log("\nwatchdog:", out.watchdog.verifiedPasses, "of", out.watchdog.checkedPasses, "passes independently re-verified; downgraded:", JSON.stringify(out.watchdog.downgraded));
console.log("TRUTHFUL READINESS:", out.readiness.score + "/100", JSON.stringify(out.readiness.counts), "unverifiedPasses:", out.readiness.unverifiedPasses);

const tmp = "/tmp/fake-app"; await fs.mkdir(tmp, { recursive: true });
await fs.writeFile(tmp + "/page.tsx", "export default function P(){ return <div>Welcome — lorem ipsum dolor sit amet</div>; }\n");
await fs.writeFile(tmp + "/handler.ts", 'export function handler(){ throw new Error("not implemented yet"); }\n');
const cf = await scanCompleteness(tmp);
console.log("\n=== COMPLETENESS (anti-fake) on a planted-fake dir ===", cf.length, "findings");
cf.forEach((f) => console.log(" ", f.severity, f.confidence, f.kind, "—", f.explain));
const cf2 = await scanCompleteness("fixtures/buggy-shop");
console.log("completeness on the real fixture (expect 0 — its bugs are runtime):", cf2.length);
