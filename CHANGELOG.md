# Changelog

All notable changes to LaunchAudit are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-17

First public release.

### Added
- Standalone CLI audit (`runner/audit.ts`) — scan repo, crawl the running app,
  generate checks, execute in real Chromium + HTTP, classify, score, and write a
  self-contained HTML report. No API key, no hosted backend.
- MCP server (`runner/mcp-server.ts`) exposing 10 `launchaudit_*` tools so any
  MCP-capable agent (Claude Code, Cursor, Codex) can run the full audit.
- Claude Code skill + `/launch-audit` command for the audit -> fix -> re-verify loop.
- Deep checks: frontend, backend, admin/RBAC, IDOR/object-authz, write-authz,
  middleware/security headers, secrets exposure, cookies, CORS, TLS/HSTS,
  injection, accessibility (axe-core), SEO/structured data, Core Web Vitals,
  content integrity, and ElevenLabs voice-agent config.
- Truth Protocol: a watchdog independently re-verifies every pass against fresh
  evidence; unreproducible passes are downgraded, never silently passed.
- Generate-PRD export: turn an audit into a paste-ready spec for a coding agent.
- Audit a GitHub repo via the user's own git auth (local clone, code stays local).
- Optional hosted dashboard (`public/`, `api/`) deployable to Vercel with Neon
  Postgres persistence and Vercel Blob evidence storage.

### Proof
- Bundled fixture `fixtures/buggy-shop` has 5 planted bugs; the audit catches all
  5 and does not false-flag the intentionally-correct routes.
