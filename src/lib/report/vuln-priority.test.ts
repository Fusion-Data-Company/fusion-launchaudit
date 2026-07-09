import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCveIds, parseEpssResponse, parseKevCatalog, rankVulns, type VulnEntry } from "./vuln-priority.ts";

test("extractCveIds pulls CVEs from id + aliases, dedupes, uppercases", () => {
  const ids = extractCveIds([
    { id: "GHSA-xxxx", aliases: ["CVE-2024-1234", "cve-2024-1234"] },
    { id: "CVE-2023-9999" },
    { id: "GHSA-only" },
  ]);
  assert.deepEqual(ids.sort(), ["CVE-2023-9999", "CVE-2024-1234"]);
});

test("parseEpssResponse reads the FIRST API shape", () => {
  const m = parseEpssResponse({ data: [{ cve: "CVE-2024-1234", epss: "0.87" }, { cve: "CVE-2023-1", epss: 0.02 }] });
  assert.equal(m.get("CVE-2024-1234"), 0.87);
  assert.equal(m.get("CVE-2023-1"), 0.02);
});

test("parseKevCatalog reads the CISA KEV shape", () => {
  const s = parseKevCatalog({ vulnerabilities: [{ cveID: "CVE-2024-1234" }, { cveID: "cve-2021-44228" }] });
  assert.ok(s.has("CVE-2024-1234"));
  assert.ok(s.has("CVE-2021-44228"));
});

const E = (over: Partial<VulnEntry>): VulnEntry => ({ name: "p", version: "1.0.0", direct: false, imported: false, cveIds: [], advisoryCount: 1, ...over });

test("a KEV-listed dep outranks a high-EPSS one, which outranks a plain one", () => {
  const entries = [
    E({ name: "plain", cveIds: ["CVE-2020-0001"] }),
    E({ name: "highepss", cveIds: ["CVE-2024-2222"] }),
    E({ name: "kevdep", cveIds: ["CVE-2021-44228"] }),
  ];
  const epss = new Map([["CVE-2024-2222", 0.9], ["CVE-2020-0001", 0.001]]);
  const kev = new Set(["CVE-2021-44228"]);
  const ranked = rankVulns(entries, epss, kev);
  assert.deepEqual(ranked.map((r) => r.name), ["kevdep", "highepss", "plain"]);
  assert.equal(ranked[0].priority.startsWith("P0"), true);
  assert.ok(ranked[0].tag.includes("KEV"));
  assert.ok(ranked[1].tag.includes("EPSS 0.90"));
});

test("with no EPSS/KEV data, reachability (imported) beats a bare transitive dep", () => {
  const entries = [E({ name: "transitive" }), E({ name: "reachable", imported: true })];
  const ranked = rankVulns(entries, new Map(), new Set());
  assert.deepEqual(ranked.map((r) => r.name), ["reachable", "transitive"]);
  assert.ok(ranked[0].priority.includes("reachable"));
});

test("ranking is deterministic across calls", () => {
  const entries = [E({ name: "a", cveIds: ["CVE-1"] }), E({ name: "b", cveIds: ["CVE-2"] })];
  const epss = new Map([["CVE-1", 0.3], ["CVE-2", 0.6]]);
  const r1 = rankVulns(entries, epss, new Set()).map((r) => r.name);
  const r2 = rankVulns(entries, epss, new Set()).map((r) => r.name);
  assert.deepEqual(r1, r2);
  assert.deepEqual(r1, ["b", "a"]); // higher EPSS first
});
