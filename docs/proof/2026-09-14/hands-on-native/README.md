# Native Next authorization verification, September 14, 2026

This is an authentic isolated engineering exercise on Fusion-owned RentDesk, not customer work or a paid audit completion. It supplements the published hands-on sample, whose earlier request adapter did not exercise native Next transport.

## Verified results

- Real browser password sign-in used the native Next Server Action and reached the dashboard. Actual bcrypt, persisted sessions, HMAC cookie validation, middleware, layouts and application actions ran unchanged.
- Owner A used Settings Save to rename the account to `ISOLATED Native Account A verified`. Direct PostgreSQL inspection confirms persistence. Account B remains unchanged.
- Owner A fetched own receipt101:200 and foreign201:404. Owner B fetched own201:200 and foreign101:404. These requests traversed the actual native receipt route.
- A viewer replayed the exact native renameAccount action captured from the legitimate UI. The native RSC response contained `Your access to this account is read-only.` Account state stayed unchanged. Viewer account export returned403.
- A native action with the browser's real Origin but deliberately conflicting X-Forwarded-Host returned500 `Invalid Server Actions request.` This verifies Next's origin-versus-forwarded-host protection. The valid session still supported normal Sign out afterward.
- Actual Settings Sign out followed by dashboard navigation redirected to `/login?next=%2Fdashboard`. Screenshot visually inspected. This checks ordinary logout; stolen-cookie replay after revocation was not separately exercised.
- After expiring only the disposable Account A trial in SQL, owner native writes returned the read-only error, account export returned200 with real isolated records, and `/refunds` returned200. No billing/provider action was invoked.

## Runtime and boundaries

RentDesk source224f76d598e380e336f3d27b97477a6a7d7a28bb, native Next16.3.4 dev webpack on127.0.0.1:4319. Local PostgreSQL14.22 on55439, real generated19-table Drizzle schema and property-scope SQL functions. Synthetic owners A/B, viewer and manager; no customer records or production credentials. Existing dependencies only. All runtime environment was explicitly passed; no .env was read.

The only application-source modification was the preserved `isolated-db-binding.patch`: the existing Neon Pool/Drizzle driver connects through a fixed loopback WebSocket relay to disposable PostgreSQL. Node's built-in WebSocket avoids local optional ws native-module bundling. The guard rejects any database other than this exact loopback fixture. This binding is proof infrastructure, must never deploy, and was restored after verification.

This closes native browser sign-in, persisted owner write, reciprocal account route isolation, viewer role denial, ordinary logout, native CSRF origin comparison and expired-account export coverage. It does not prove production Neon network behavior, production HTTPS Secure cookie configuration, Clerk/Fusion SSO, actual hostile-site browser CSRF variants, copied-cookie replay, or a separate native restricted-manager property matrix. The prior bounded adapter already covered scoped manager behavior; that is not relabeled native here. No application vulnerability was found in this native matrix. No production code repair was needed.

## Evidence and rerun

`native-write-session-chain.log` is the successful UI/write/CSRF/logout chain. `native-account-b.log`, `native-viewer-denial.log`, `native-expired-export.log`, and `persisted-account-state.txt` contain focused evidence. Screenshots show actual native Settings and logged-out login. `native-owner-chain.log` additionally contains the passing A receipt checks but also early failed UI setup steps; `native-browser-log.json` records earlier unsuccessful tooling attempts and is not acceptance evidence.

The Python chain scripts use gstack's single-invocation chain because this host can lose browser state across exec calls. They assume the explicitly guarded native runtime and disposable schema/seed exist. Run each identity script in a fresh browser session, or sign out between identities. The welcome tour must be dismissed before normal Settings actions. Setup scripts are local engineering fixtures, not product adapters. Do not publish these scripts, schema or fixture source as a customer deliverable.
