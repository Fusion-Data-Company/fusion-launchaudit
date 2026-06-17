# Test-Catalog Research Protocol (provenance-first)

Mission: build the most exhaustive catalog of software tests that can be run for a
web-application launch-readiness auditor — every test, in every domain — where
**every single entry is traceable to a real, named source.** No invented tests,
no invented sources. This is a Truth-Protocol task.

## Research engine: Perplexity (Rob's account)

Use ONLY the Perplexity API. The key is in the environment as `PERPLEXITY_API_KEY`.

```bash
curl -s https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"sonar-pro","messages":[
    {"role":"system","content":"You are a QA/security testing research librarian. Cite only real, authoritative, published sources (standards bodies, official tool docs, recognized security/testing orgs). Never invent a source or a standard reference."},
    {"role":"user","content":"<your question>"}]}' \
  -o docs/research/test-catalog/raw/<domain>-NN.json -w "HTTP %{http_code}\n"
```

- Model: `sonar-pro` (good citations). Use a second `sonar-reasoning` pass for the
  "what did we miss" completeness sweep if useful.
- On HTTP 429 (rate limit): `sleep 15` and retry, up to 3 times.
- **Save the raw JSON of EVERY call** to `docs/research/test-catalog/raw/<domain>-NN.json`.
  This is the audit trail — it must exist for every claim.

## Query strategy (run several calls; go deep)

1. **Sources pass** — "List the canonical published sources/standards for `<domain>`
   testing of web apps: name, organization, what test categories they define, URL."
2. **Enumeration pass(es)** — "Exhaustively enumerate the individual tests/checks
   defined by `<source>` for web apps. For EACH, give the check, what it verifies,
   and its standard reference (e.g. WSTG-ATHZ-01, WCAG 1.1.1, CWE-639)." Repeat per
   major source and per subcategory until exhausted.
3. **Completeness pass** — "What categories of `<domain>` tests are commonly missed
   or omitted from standard checklists?" Fold the answers in.

## The provenance law (hard rule)

- Every catalog row MUST carry a **Source name + URL** that appeared in Perplexity's
  answer or its citations, and a **standard reference** where one exists.
- If Perplexity asserts a test but gives no source, include it tagged **[UNVERIFIED]**
  in a separate "Unverified / needs a source" section — never in the main table.
- If you are tempted to add a test from your own training knowledge that Perplexity
  did not surface, DO NOT add it silently. Put it under "[MODEL-SUGGESTED — confirm]"
  so Rob can see exactly what is not yet source-backed.
- Prefer the canonical standard URL (owasp.org, w3.org, web.dev, nist.gov, etc.) over
  a blog as the cited Source URL; the raw JSON keeps the full retrieval trail.

## Output: `docs/research/test-catalog/<NN>-<domain>.md`

```
# <Domain> — Test Catalog

## Sources used
| Source | Org | Covers | URL |

## Tests
| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |

## Unverified / needs a source
## [MODEL-SUGGESTED — confirm]
## Raw evidence
- list the raw/<domain>-NN.json files produced
```

Aim for breadth AND depth — dozens to hundreds of rows per domain where the
standards support it. Be exhaustive; this is a "boil the lake" catalog.

## Return to the orchestrator
A short summary only: domain, # tests catalogued, # sources, the output file path,
the list of raw JSON files, and anything you could NOT source. Do NOT paste the full
catalog back — it lives in the file.
