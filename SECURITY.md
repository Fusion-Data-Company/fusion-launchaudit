# Security Policy

80/20 Launch Audit is a security-adjacent tool, so we take its own security seriously.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Email **rob@fusiondataco.com** with:
- a description of the issue and its impact,
- steps to reproduce (a proof of concept if possible),
- any suggested remediation.

You'll get an acknowledgement within 3 business days. We'll work with you on a
fix and a coordinated disclosure timeline, and credit you in the release notes
unless you prefer to stay anonymous.

## Scope

80/20 Launch Audit runs on the user's own machine inside their own coding agent. It has
no hosted backend in the core product; the optional dashboard (`public/`, `api/`)
is the main remote surface. Reports about either are welcome.

## Handling of credentials

80/20 Launch Audit captures auth state and reads connection strings **locally only** —
credentials never leave the user's machine in the core product. If you find a
path where a secret is logged, transmitted, or persisted unexpectedly, treat it
as a vulnerability and report it.
