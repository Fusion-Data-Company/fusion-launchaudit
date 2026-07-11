# vuln-saas — planted MODERN bugs (ground truth)

This fixture proves the elite wedge catches the bug classes the happy-path AI and most
scanners miss. Every item is deliberate. The proof harness (`scripts/elite-proof.ts`) runs
the real generator → executor → classify path against this app and must catch all of them.

| # | Bug | Where | Detector (category) | Why the AI/competition miss it |
|---|-----|-------|--------------------|--------------------------------|
| 1 | **Cross-user IDOR / BOLA** — any user reads any order by id | `GET /api/orders/:id` (no ownership check) | `object_authz` | Happy path only ever fetches *your own* order; nobody logs in as Bob and requests Alice's id |
| 2 | **Excessive data exposure** — passwordHash / ssn / card_number in the response | `GET /api/orders/:id`, `/api/users/:id` | `data_exposure` | The demo renders name + total; nobody inspects the raw JSON for secret fields |
| 3 | **Mass-assignment / privilege escalation** — `role:"admin"` accepted | `POST /api/profile` | `mass_assignment` | The UI form never sends `role`; only a crafted request does |
| 4 | **Broken function-level authz (BFLA)** — normal user deletes users | `POST /api/admin/delete-user` (no role check) | `mutation_authz` | The button is hidden in the UI, so the happy path never calls it |
| 5 | **Race condition / TOCTOU** — single-use coupon double-spent | `POST /api/coupon/redeem` (no lock) | `race_condition` | Sequential testing redeems once and sees success; only *concurrent* requests expose it |
| 6 | **Prompt injection + unsafe output** — AI echoes injected instructions & raw `<script>` | `POST /api/chat` | `ai_security` | The AI "works" in the demo; nobody feeds it an injection canary |
| 7 | **Malicious dependency** — `postinstall: curl … | sh` + a typosquat (`reactt`) | `package.json` | No CVE exists yet; a CVE scanner sees nothing |
| 8 | **Broken privilege gradient + RBAC** — `/admin` served to anon & normal users | `GET /admin` | `privilege_gradient`, `roles_permissions` | The link is hidden for non-admins, so the UI *looks* locked down |
| 9 | **Missing security headers** | every response | `security_headers` | Invisible unless you inspect headers |

Users: `alice` (owns order 1), `bob` (owns order 2), `admin`. Sessions are the deterministic
cookie `session=<username>` (POST /login sets it). Signing is intentionally omitted — that's
not the planted bug, it just keeps the fixture reproducible.
