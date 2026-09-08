# MODEL — 80/20 Launch Audit monetization decision

Status: recorded for the monetization step (step 5). No Stripe products, prices, or
checkout code were changed to write this. The live $79 Single Run checkout is
untouched and still works; this file records where pricing should move.

## The finding that forces the change

The comps memo (`/home/claude/comps/launch-audit.md`) is blunt: a $79 one-off
automated URL scan is not a business. Free tools (Lighthouse, securityheaders.com,
Mozilla Observatory, Ahrefs Webmaster Tools, axe) cover nearly every line item; the
direct competitor (Vibe App Scanner) gives the same scan away free and charges
$19-39/mo for the findings; the one public revenue figure for this exact product
shape is SecureVibing at $260 MRR after 5 months. One-off money in this category is
human-delivered ($297-$499 audits, $1,999+ pentests).

## The model (seats / copies / service)

This is a **service + subscription** business, not a one-off copy sale. Three lines:

| Line | Price | What it is | Why this price |
|---|---|---|---|
| **Free surface scan** | $0 | The hosted URL scan with the vibe-coder checks (Supabase/Firebase rules, leaked keys, open admin, dev-build leaks, placeholders) + agent-ready fixes. Top 5 findings shown; the rest unlock with an email. | Match Vibe App Scanner's shape. The scan is the lead magnet and the top of the funnel, not the product. Free tools already give the scan away — charging 4x a competitor's monthly price for less is the current mistake. |
| **Monitoring** | **$24 / month** | Weekly re-scan per URL, finding history + score trend, a diff of what broke / got fixed, email alert on a score drop, PDF export with white-label header. | The only recurring line the category actually sustains. Priced between Vibe App Scanner Go ($19) and Pro ($39); undercuts SEOptimer ($29) while adding the RLS/keys checks agencies can't get elsewhere. Annual at ~2 months off ($240/yr). |
| **Deep Audit (service)** | **$499 productized · $1,200-1,500 authenticated** | Human-run Playwright deep audit of one live app: broken access control, admin/RBAC, write-authz, authenticated flows with a test login, evidence report, prioritized fix plan, one re-audit. Fixed scope, 2-day turnaround. | This is where the first real dollars are. Matches Launch Ready Code ($499) and Astra's floor, and how money is actually spent here (done-for-you, not self-serve). The authenticated tier ($1,200-1,500) adds the two-identity IDOR/BFLA testing the automated scan can't prove. |

### What was built tonight to support this model
- Free scan enriched with the vibe-coder checks the free tools skip, each finding
  carrying a paste-ready Cursor/Claude Code fix (the $19/mo table-stakes feature,
  now in the free tier as the hook).
- Free result gated: top 5 findings shown, the rest unlocked by email (lead capture
  in Postgres: `scan_leads`), which is the on-ramp to Monitoring.
- Monitoring plumbing: `scans` history, `monitors` enrolment, a weekly Vercel Cron
  re-scan (`/api/rescan-cron`) that diffs and (only if the operator's own SMTP is
  configured) emails the diff, and a `/monitor` page with a score sparkline + diff.
- Agency: white-label PDF export (agency name + logo, stored per monitor) from the
  `/monitor` page.

### What is deliberately NOT done (step 5, monetization)
- No Stripe product/price for the $24/mo monitoring or the $499/$1,500 Deep Audit.
  The unlock button captures an email today; wiring a subscription price and a
  service intake/checkout is the monetization step.
- The $79 Single Run checkout stays exactly as-is until step 5 decides whether to
  retire it in favour of free-scan + $24/mo (the memo's recommendation).

### Recommended step-5 sequence
1. Add a Stripe subscription price for Monitoring at $24/mo, wire the unlock's
   "watch weekly" toggle to it.
2. Productize the Deep Audit at $499 (fixed scope) with a simple intake form;
   $1,200-1,500 for authenticated. Sell it to the agencies and funded founders the
   free scan surfaces.
3. Retire or de-emphasize the $79 one-off (keep it only as a Deep Audit deposit).
