import type { RepoScan } from "../../../runner/repo-scanner.ts";
import type { RuntimeCrawl } from "../../../runner/crawler.ts";
import { type AuditHints, type Counter, type GeneratedCard } from "./types.ts";

export function generateFrontend(scan: RepoScan | null, crawl: RuntimeCrawl, _hints: AuditHints, c: Counter): GeneratedCard[] {
  const cards: GeneratedCard[] = [];

  cards.push({
    id: c.next("TC-FE"), title: "App shell loads and renders for a first-time visitor",
    category: "core_workflow", status: "ready", risk: "critical",
    goal: "The site loads and shows interactive content to a new visitor.",
    steps: ["Open the home page", "Wait for network idle", "Confirm interactive content"],
    expectedEvidence: ["screenshot"], dataNeeds: [],
    acceptanceCriteria: `Home reaches network idle with interactive content (${crawl.button_count} buttons seen).`,
    exec: [{ action: "goto", url: crawl.app_url }, { action: "wait", ms: 700 }, { action: "expect_visible", selector: crawl.button_count > 0 ? "button, a, [role=button]" : "body" }],
  });

  for (const link of crawl.links.slice(0, 12)) {
    const label = link.text || new URL(link.href).pathname;
    cards.push({
      id: c.next("TC-FE"), title: `Page reachable: ${label}`, category: "core_workflow", status: "ready", risk: "high",
      goal: `The page "${label}" found in the live site responds without a server error.`,
      steps: [`GET ${link.href}`], expectedEvidence: ["network_log"], dataNeeds: [],
      acceptanceCriteria: `${link.href} returns a non-5xx status.`,
      exec: [{ action: "http", url: link.href, expectStatusNot: [500, 502, 503, 504] }],
    });
  }

  for (const [w, h, label] of [[390, 844, "phone"], [768, 1024, "tablet"]] as const) {
    cards.push({
      id: c.next("TC-FE"), title: `No horizontal overflow on ${label} (${w}px)`, category: "responsive_visual", status: "ready", risk: "high",
      goal: `The layout is usable on a ${label} — no sideways scrolling.`,
      steps: [`Set ${w}x${h} viewport`, "Open home", "Measure overflow"], expectedEvidence: ["screenshot"], dataNeeds: [],
      acceptanceCriteria: `scrollWidth <= clientWidth at ${w}px.`,
      exec: [{ action: "set_viewport", width: w, height: h }, { action: "goto", url: crawl.app_url }, { action: "wait", ms: 600 }, { action: "expect_no_horizontal_overflow" }],
    });
  }

  cards.push({
    id: c.next("TC-FE"), title: "Clean console and no 5xx on load", category: "console_network", status: "ready", risk: "high",
    goal: "No console errors or failing requests when the home page loads.",
    steps: ["Open home", "Collect console + network", "Assert clean"], expectedEvidence: ["network_log", "screenshot"], dataNeeds: [],
    acceptanceCriteria: `Zero console.error and zero 5xx (crawl saw ${crawl.console_errors_on_load}).`,
    exec: [{ action: "goto", url: crawl.app_url }, { action: "wait", ms: 1100 }, { action: "expect_console_clean" }, { action: "expect_network_clean" }],
  });

  return cards;
}
