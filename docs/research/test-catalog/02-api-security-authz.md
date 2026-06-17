# API Security & Authorization — Test Catalog

> LaunchAudit's competitive wedge. Provenance-first: every row traces to a real,
> named source surfaced by Perplexity (Rob's account). Raw retrieval JSON is kept
> under `raw/api-security-NN.json` as the audit trail.
>
> **Coverage note:** This catalog deeply covers the three authorization categories
> that are LaunchAudit's wedge — API1 BOLA/IDOR, API5 BFLA, API3 BOPLA — sourced
> from raw files 01-04. Calls for the remaining OWASP API risks (API2
> authentication/JWT, API4/API6 resource consumption & business flows, API7/API8
> SSRF & misconfiguration) plus CORS and schema/contract validation were queued
> but did NOT complete: a full-disk condition on the research host blocked them
> mid-run. Those topics are honestly flagged in **Gaps — not yet researched
> (disk blocker)** rather than padded with unsourced content.

## Sources used

| Source | Org | Covers | URL |
|---|---|---|---|
| OWASP API Security Top 10 – 2023 (header / list) | OWASP Foundation – API Security Project | 10 API risk categories incl. API1 BOLA, API3 BOPLA, API5 BFLA | https://owasp.org/API-Security/editions/2023/en/0x11-t10/ |
| OWASP API1:2023 Broken Object Level Authorization | OWASP | Object-level authz (BOLA/IDOR) | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ |
| OWASP API3:2023 Broken Object Property Level Authorization | OWASP | Mass assignment + excessive data exposure (field-level authz) | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ |
| OWASP API5:2023 Broken Function Level Authorization | OWASP | Function-level authz / vertical privilege escalation | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ |
| OWASP WSTG-ATHZ-04 Testing for Insecure Direct Object References | OWASP – Web Security Testing Guide | IDOR / object-id swap testing | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References |
| OWASP WSTG-ATHZ-02 Testing for Bypassing Authorization Schema | OWASP – WSTG | Authorization bypass via alternate paths/verbs | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/02-Testing_for_Bypassing_Authorization_Schema |
| OWASP WSTG-ATHZ-03 Testing for Privilege Escalation | OWASP – WSTG | Vertical/role privilege escalation | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/03-Testing_for_Privilege_Escalation |
| OWASP WSTG-INPV-13 Testing for Mass Assignment | OWASP – WSTG | Mass assignment / parameter binding | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/13-Testing_for_Mass_Assignment |
| CWE-639 Authorization Bypass Through User-Controlled Key | MITRE | IDOR / object-id manipulation | https://cwe.mitre.org/data/definitions/639.html |
| CWE-566 Authorization Bypass Through User-Controlled SQL Primary Key | MITRE | Access control via client-supplied key | https://cwe.mitre.org/data/definitions/566.html |
| CWE-285 Improper Authorization | MITRE | Missing/wrong authz decision | https://cwe.mitre.org/data/definitions/285.html |
| CWE-862 Missing Authorization | MITRE | No authz check on a function | https://cwe.mitre.org/data/definitions/862.html |
| CWE-863 Incorrect Authorization | MITRE | Authz check present but wrong | https://cwe.mitre.org/data/definitions/863.html |
| CWE-915 Improperly Controlled Modification of Dynamically-Determined Object Attributes | MITRE | Mass assignment | https://cwe.mitre.org/data/definitions/915.html |
| CWE-213 Exposure of Sensitive Information Due to Incompatible Policies | MITRE | Excessive data exposure | https://cwe.mitre.org/data/definitions/213.html |

> Note on the OWASP API Security Testing Guide and OWASP ASVS Access Control
> chapter: the sources pass (raw/api-security-01.json) confirmed both exist as
> canonical OWASP works, but the per-requirement enumeration calls for them did
> not run before the disk blocker. They are listed in Gaps below.

## Tests

Automatable column legend: **Yes** = LaunchAudit can drive this with two test
accounts + request replay; **Partial** = needs app-specific fixtures (known
object IDs, role matrix, or human confirmation of "sensitive"); **Manual** =
requires human judgement / business context.

### API1:2023 — Broken Object Level Authorization (BOLA / IDOR) — source: raw/api-security-02.json

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 1 | As User A, GET an object by an ID belonging to User B (path/query/body) | Object-level authz enforced on READ, not just authentication | BOLA read | OWASP API1:2023; WSTG-ATHZ-04; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Yes |
| 2 | As User A, PUT/PATCH (update) an object owned by User B | Object-level authz on state-changing WRITE | BOLA write | OWASP API1:2023; WSTG-ATHZ-04; CWE-639, CWE-566 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Yes |
| 3 | As User A, DELETE an object owned by User B | Object-level authz on destructive DELETE | BOLA delete | OWASP API1:2023; WSTG-ATHZ-04; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Yes |
| 4 | Swap the ID across every location it appears (path, query, body) individually and together | Server authorizes from authenticated context, not one "canonical" ID location | BOLA parameter location | OWASP API1:2023; WSTG-ATHZ-04; CWE-639 | OWASP WSTG-ATHZ-04 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References | Yes |
| 5 | Enumerate sequential/predictable numeric IDs (increment/decrement, range) with GET/PUT/DELETE | Predictable IDs don't grant access; proper authz present | BOLA enumeration | OWASP API1:2023; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Yes |
| 6 | Reuse another user's UUID/GUID across path/query/body/header | UUIDs aren't treated as secrets; authz still verifies ownership | BOLA UUID | OWASP API1:2023; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Partial |
| 7 | Nested resource swaps: valid parent + other user's child ID, and vice versa | API validates parent/child relationship ownership, not just one ID | BOLA nested | OWASP API1:2023; WSTG-ATHZ-04; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Partial |
| 8 | Swap indirect references (filenames, receipt/document IDs) in file/download endpoints | Indirect references tied to objects are authz-protected | BOLA indirect ref | OWASP API1:2023; WSTG-ATHZ-04; CWE-566, CWE-639 | OWASP WSTG-ATHZ-04 | https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References | Partial |
| 9 | Modify object/tenant IDs carried in custom headers (X-User-Id, X-Org-Id, X-Account-Id) | Server doesn't trust client-supplied IDs in headers | BOLA header ID | OWASP API1:2023; CWE-639, CWE-566 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Yes |
| 10 | Call bulk/list/export endpoints as low-priv user; abuse offset/limit/fromId to traverse others' data | List/export endpoints filter by user/tenant | BOLA bulk export | OWASP API1:2023; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Partial |
| 11 | Multi-tenant org-id swap (path/query/body/header) for list/read/create/update/delete | Cross-tenant isolation enforced by object-level authz | BOLA multi-tenant | OWASP API1:2023; WSTG-ATHZ-04; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Partial |
| 12 | Change a `userId`/`accountNo` filter parameter to another user's value | Server scopes results to authenticated identity, ignoring owner filters | BOLA query filter | OWASP API1:2023; WSTG-ATHZ-04; CWE-566, CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Yes |
| 13 | Call explicit `/users/{id}` with another user's ID where a `/me` endpoint also exists | Explicit-ID endpoints enforce same authz as /me | BOLA me-vs-id | OWASP API1:2023; WSTG-ATHZ-04; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Yes |
| 14 | GraphQL: supply other users' node/global IDs in queries/mutations; tamper base64 global IDs | GraphQL resolvers enforce per-node object authz | BOLA GraphQL | OWASP API1:2023; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Partial |
| 15 | Create/modify a child object referencing a parent (postId/ticketId) owned by another user | Server checks ownership of the referenced related object | BOLA cross-object link | OWASP API1:2023; CWE-639 | OWASP API1:2023 | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ | Partial |

### API5:2023 — Broken Function Level Authorization (BFLA) / vertical privilege escalation — source: raw/api-security-03.json

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 16 | As non-admin, call clearly admin-labeled endpoints (GET/POST/DELETE /api/admin/*) | Function-level authz enforced on admin functions | BFLA admin endpoint | OWASP API5:2023; WSTG-ATHZ-03; CWE-285, CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Yes |
| 17 | As regular user, call admin actions hidden under non-admin paths (bulk-delete, assign-role, config) | Authz based on role/permissions, not URL naming | BFLA mixed path | OWASP API5:2023; WSTG-ATHZ-02; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 18 | Attempt "all users / all tenants / audit logs" listings as a standard user | Privileged global listings require admin role | BFLA global list | OWASP API5:2023; WSTG-ATHZ-03; CWE-285, CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 19 | On a read-only-for-role endpoint, try DELETE/PUT/POST as that role | Authz applied per method/operation, not just per path | BFLA method swap | OWASP API5:2023; WSTG-ATHZ-02; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Yes |
| 20 | Send undocumented HTTP methods (POST/PUT/DELETE) against a documented GET route | Only intended operations exist and are authz-checked | BFLA hidden method | OWASP API5:2023; WSTG-ATHZ-02; CWE-862 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Yes |
| 21 | Verify the role-to-method matrix: read-only role rejected for write verbs; write role can't do destructive global ops | Role/method matrix implemented consistently | BFLA role-method matrix | OWASP API5:2023; WSTG-ATHZ-03; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 22 | Brute-force predictable admin/privileged paths (/api/admin, /export_all, /audit/logs) as standard user | Admin routes don't rely on path obscurity | BFLA forced path | OWASP API5:2023; WSTG-ATHZ-02; CWE-862 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Yes |
| 23 | Try higher-role path prefixes (/manager, /partner, /root) as a normal user | URL role segmentation backed by server-side authz | BFLA role prefix | OWASP API5:2023; WSTG-ATHZ-03; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 24 | Forced-browse admin-UI-only operations directly (exportAll, reindex, reconcile) | Privileged ops can't run by knowing the URL | BFLA forced browsing | OWASP API5:2023; WSTG-ATHZ-02; CWE-862 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 25 | Use a low-privilege token against admin functions; confirm denial | Server enforces role/scope from the presented token | BFLA token role | OWASP API5:2023; WSTG-ATHZ-03; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Yes |
| 26 | Downgrade/remove scopes or role claim; confirm access actually removed | Authz relies on effective role/scope, restricts when downgraded | BFLA scope downgrade | OWASP API5:2023; WSTG-ATHZ-03; CWE-285, CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 27 | Discover and call undocumented/shadow endpoints (/internal/*, /debug/*, /v0/*) as low-priv/anonymous | Internal/undocumented functions still require authz | BFLA shadow endpoint | OWASP API5:2023; WSTG-ATHZ-02; CWE-862 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 28 | Call legacy function variants (/v0/admin/*, /legacy/exportUsers) for privileged actions | Legacy functions removed or under current authz | BFLA legacy variant | OWASP API5:2023; WSTG-ATHZ-02; CWE-862, CWE-285 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 29 | Compare authz between API versions of the same function (v1 vs v2 create/delete user) | Authz consistent across versions; old version not looser | BFLA version bypass | OWASP API5:2023; WSTG-ATHZ-02; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 30 | Call a dangerous function removed in v2 via its v1 path (DELETE /v1/users/{id}) as low-priv | Deprecation doesn't leave old version exposed | BFLA deprecated version | OWASP API5:2023; WSTG-ATHZ-03; CWE-285, CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 31 | Capture admin-UI API calls (dev tools) and replay them directly as a non-admin | Authz enforced server-side at API level, not just UI | BFLA UI-only check | OWASP API5:2023; WSTG-ATHZ-02; CWE-862 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 32 | Replay a multi-step admin workflow (create-tenant wizard) call-by-call as a regular user | Every step of a multi-call workflow enforces authz | BFLA workflow steps | OWASP API5:2023; WSTG-ATHZ-03; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Manual |
| 33 | Lower-role user invokes higher-role group functions (suspend tenant, reset password) | Role/group hierarchy enforced at function level | BFLA group hierarchy | OWASP API5:2023; WSTG-ATHZ-03; CWE-285, CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 34 | Tenant-admin attempts system-admin-only functions (register tenant, global config) | Tenant-admin vs system-admin boundary enforced per function | BFLA cross-tenant admin | OWASP API5:2023; WSTG-ATHZ-03; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 35 | Call privileged functions with NO authentication (anonymous) | Privileged functions require auth + authz, not just auth | BFLA anonymous access | OWASP API5:2023; WSTG-ATHZ-02; CWE-862 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Yes |
| 36 | Compare authz on functionally-equivalent endpoints (/users vs /users/summary) across roles | No equivalent function left with looser/no checks | BFLA inconsistent enforcement | OWASP API5:2023; WSTG-ATHZ-02; CWE-863 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |
| 37 | Hit newly added/misconfigured endpoints with low-priv/anonymous to detect default-allow | System follows deny-by-default for all functions | BFLA default-allow | OWASP API5:2023; CWE-285, CWE-862 | OWASP API5:2023 | https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/ | Partial |

### API3:2023 — Broken Object Property Level Authorization (mass assignment + excessive data exposure) — source: raw/api-security-04.json

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 38 | On profile update, add isAdmin/is_admin/admin flag variants | Property-level authz allowlists writable fields | Mass assignment privilege | OWASP API3:2023; WSTG-INPV-13; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 39 | On self-service update, add role/roles field to escalate | Low-priv users can't assign elevated roles via mass assignment | Mass assignment role | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 40 | Inject balance/creditLimit/score/loyaltyPoints on financial/gamification objects | Server-controlled financial fields not client-writable | Mass assignment financial | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 41 | Add account-lifecycle flags (isActive, isBanned, emailVerified) | Lifecycle flags controlled only by backend workflows | Mass assignment lifecycle | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 42 | Add permissions/scopes/allowedActions ACL fields | Authz policy not client-controllable | Mass assignment ACL | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 43 | Send a different `id`/primary key value in update body | Backend ignores body id, uses path/server context | Mass assignment id overwrite | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 44 | Overwrite audit fields (createdAt/createdBy/updatedBy) | Audit metadata is server-only | Mass assignment audit | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 45 | On a profile (non-password) endpoint, add passwordHash/password_hash/passwordHistory | Password fields rejected outside dedicated flows | Mass assignment password | OWASP API3:2023; CWE-915, CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 46 | Add refreshToken/apiKey/deviceToken on account/device endpoints | Tokens/keys never bound from generic object updates | Mass assignment tokens | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 47 | Inject/change ownership fields (ownerId/userId/accountId) on resource update | Ownership derived from auth context/path, not client field | Mass assignment ownership | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 48 | Force internal workflow state (status=APPROVED, workflowState=PAID, isPaid=true) | Business state transitions enforced server-side | Mass assignment state | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 49 | Fuzz JSON bodies for hidden writable params (Arjun/Param Miner/ffuf wordlists) | No undocumented sensitive properties accept values | Mass assignment param fuzz | OWASP API3:2023; WSTG-INPV-13; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 50 | Mirror all response fields back into an update request, modify one by one | No returned field is silently writable via generic binding | Mass assignment response mirror | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 51 | Diff UI-visible fields vs raw JSON for the same object (profile page) | API doesn't expose properties beyond role's need | Excessive exposure UI-diff | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 52 | Compare fields returned by list endpoint vs detail endpoint | List/search endpoints respect minimal-data principle | Excessive exposure list | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 53 | Diff same endpoint's response as regular user vs admin; try admin-only fields as low-priv | Field-level authz differs by role | Excessive exposure role-diff | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 54 | Scan responses for password/passwordHash/salt/passwordLastChanged | Credentials/password artifacts never returned | Excessive exposure password | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 55 | Scan responses for apiKey/accessToken/refreshToken/sessionId/jwt/secret/clientSecret | Tokens/secrets only returned in issuance flows | Excessive exposure tokens | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 56 | Scan responses for unneeded PII (ssn, national ID, full DOB, address, medical) | PII exposure limited to what the endpoint/role requires | Excessive exposure PII | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 57 | Scan normal AND error responses for debug/stackTrace/internalId/dbId/featureFlags/internalNotes | Internal/operational data not exposed to users | Excessive exposure internal | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 58 | GraphQL: select extra fields (isAdmin, role, permissions, tokens) not used by UI | Per-field authz in GraphQL resolvers | Excessive exposure GraphQL over-fetch | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 59 | GraphQL: deep nested relationship queries to pivot into other entities' sensitive fields | Nested objects enforce caller's authz | Excessive exposure GraphQL nested | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 60 | GraphQL mutation with extra input fields (isAdmin:true, role:"admin", balance:1000) | Input schema/resolvers reject unauthorized fields | Mass assignment GraphQL | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 61 | Call a UI-filtered endpoint directly with broader/no filters (fields=*, includeSensitive=true) | Field selection enforced server-side, not by client | Excessive exposure server filter | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 62 | Inspect mobile/SPA network calls for richer JSON than any screen displays | Clients not relied on as security boundary | Excessive exposure client-hidden | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 63 | Trigger per-property validation failures; check error payloads for full object/sensitive fields | Error handling doesn't leak whole objects/internal state | Excessive exposure error leak | OWASP API3:2023; CWE-213 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 64 | Add any property NOT in the OpenAPI/Swagger spec; observe reject vs ignore vs persist | API uses schema/DTO allowlist for requests | Mass assignment allowlist check | OWASP API3:2023; WSTG-INPV-13; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |
| 65 | Hit loosely-typed generic update endpoints (PATCH /entities/{id}) with privilege/ownership/token fields | Generic endpoints enforce fine-grained property controls | Mass assignment generic endpoint | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Partial |
| 66 | Regression: re-run all denied mass-assignment attempts after a fix | Property-level authz stays enforced over time | Mass assignment regression | OWASP API3:2023; CWE-915 | OWASP API3:2023 | https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/ | Yes |

## Gaps — not yet researched (disk blocker)

These topics were planned and queued for Perplexity enumeration but the calls did
NOT complete — a full-disk condition on the research host (ENOSPC) blocked curl
calls 05-07 mid-run and they were not re-run (per orchestrator instruction to
avoid refilling the tight disk). They are flagged here honestly rather than filled
with unsourced content. Each is ready to research in a follow-up pass with the
anchor sources noted.

| Topic | OWASP risk | Anchor sources to mine | Planned raw file |
|---|---|---|---|
| Broken Authentication / JWT flaws (alg=none, RS256→HS256 confusion, weak/missing signature verification, expiry not enforced, kid header injection, logout invalidation, brute-force/lockout, weak password policy, token in URL, revocation, OAuth flow, refresh-token rotation, MFA) | API2:2023 | OWASP API2:2023; WSTG-ATHN; WSTG-SESS; CWE-287, CWE-307, CWE-384, CWE-345; RFC 8725 (JWT BCP) | api-security-05.json (not created) |
| Unrestricted Resource Consumption / rate limiting & DoS (per-endpoint rate limits, login/OTP/reset throttling, body-size limits, pagination abuse, GraphQL depth/complexity, file-upload size, concurrency) | API4:2023 | OWASP API4:2023; WSTG-BUSL; CWE-770, CWE-799, CWE-307 | api-security-06.json (not created) |
| Unrestricted Access to Sensitive Business Flows (bulk-purchase/scalping abuse, captcha absence, business-flow rate controls) | API6:2023 | OWASP API6:2023; WSTG-BUSL | api-security-06.json (not created) |
| Server-Side Request Forgery (internal-IP / cloud-metadata 169.254.169.254, DNS rebinding, redirect-based, blind SSRF) | API7:2023 | OWASP API7:2023; WSTG-INPV; CWE-918 | api-security-07.json (not created) |
| Security Misconfiguration (verbose errors/stack traces, default creds, dangerous HTTP methods TRACE/OPTIONS, missing security headers, directory listing, debug endpoints, outdated TLS) | API8:2023 | OWASP API8:2023; WSTG-CONF; CWE-16, CWE-756 | api-security-07.json (not created) |
| CORS misconfiguration (reflected Origin, null origin, ACAO wildcard + ACAC true, pre-flight bypass) | (cross-cutting, API8) | OWASP WSTG-CLNT-07 Testing Cross Origin Resource Sharing; CWE-942 | not created |
| Schema / contract validation (OpenAPI conformance, request/response schema enforcement) | (cross-cutting, API8/API9) | OWASP API Security Testing Guide; API9:2023 Improper Inventory Management | not created |
| OWASP ASVS Access Control chapter per-requirement enumeration | (standards mapping) | OWASP ASVS Access Control (V4/V8 depending on edition) | api-security-09.json (not created) |
| Completeness sweep ("what authz/API tests are commonly missed") | (meta) | OWASP API Security Project; sonar-reasoning pass | not created |

## Unverified / needs a source

(none — every row above carries an OWASP/MITRE source name + URL drawn from the
raw JSON, which themselves cite OWASP API1/3/5:2023, WSTG-ATHZ-02/03/04,
WSTG-INPV-13, and CWE-285/566/639/862/863/915/213)

## [MODEL-SUGGESTED — confirm]

(none — no rows were added from model training knowledge; all 66 rows trace to
raw/api-security-02/03/04.json)

## Raw evidence

- raw/api-security-01.json — sources pass (OWASP API Top 10 2023, API Security Testing Guide, WSTG-ATHZ, ASVS, CWE authz set); 7 citations
- raw/api-security-02.json — API1:2023 BOLA/IDOR enumeration (rows 1-15); 7 citations
- raw/api-security-03.json — API5:2023 BFLA / vertical priv-esc enumeration (rows 16-37); 8 citations
- raw/api-security-04.json — API3:2023 BOPLA mass assignment + excessive data exposure (rows 38-66); 9 citations
