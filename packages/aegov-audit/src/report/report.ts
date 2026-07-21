/**
 * Report aggregation (STAGE2-HANDOFF §6 step 5): one machine JSON + one human
 * markdown report, shaped to mirror the official TDRA assessment checklist.
 * Every finding carries severity, rule, provenance (confidence tier) and fix;
 * the exact run conditions ride along; thresholds are evaluated ONLY under
 * the local-run caveat. Private report for the site's own team (§2 locked —
 * no scoreboards).
 */
import { createRequire } from "node:module";
import type { AuditFinding, AuditSeverity } from "./types.js";
import { countBySeverity } from "./types.js";
import type { LighthouseScores } from "../engines/lighthouse.js";
import { buildChecklistView, loadTdraCriteria, type ChecklistView } from "./tdra.js";

const require = createRequire(import.meta.url);
const own = require("../../package.json") as { name: string; version: string };

export type ThresholdRow = {
  measure: string;
  formFactor: string;
  value: number | null;
  threshold: string;
  meetsUnderLocalConditions: boolean | null;
};

export type AuditReport = {
  tool: { name: string; version: string };
  target: string;
  generatedAt: string;
  page: {
    status: number;
    loadMs: number;
    nodes: number;
    title: string;
    lang: string;
    dir: string;
    /** URL after any redirects — differs from target when the site client-redirects. */
    finalUrl?: string;
  };
  engines: Record<string, string>;
  runConditions: {
    machine: string;
    note: string;
    lighthouse: Array<LighthouseScores["runConditions"]> | null;
  };
  summary: {
    findingCount: number;
    bySeverity: Record<AuditSeverity, number>;
    byEngine: Record<string, number>;
  };
  lighthouse: {
    runs: LighthouseScores[];
    thresholds: ThresholdRow[];
    thresholdSource: Record<string, unknown>;
  } | null;
  tdraChecklist: ChecklistView;
  findings: AuditFinding[];
  disclaimers: string[];
};

function parseMin(threshold: string): number | null {
  const m = threshold.match(/>=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function thresholdRows(runs: LighthouseScores[]): ThresholdRow[] {
  const t = loadTdraCriteria().meta.pageStatedThresholds;
  const rows: ThresholdRow[] = [];
  for (const run of runs) {
    const cats: Array<[string, number | null, string]> = [
      ["accessibility", run.scores.accessibility, String(t.lighthouse.accessibility)],
      ["performance", run.scores.performance, String(t.lighthouse.performance)],
      ["seo", run.scores.seo, String(t.lighthouse.seo)],
      ["bestPractices", run.scores.bestPractices, String(t.lighthouse.bestPractices)],
    ];
    for (const [measure, value, threshold] of cats) {
      const min = parseMin(threshold);
      rows.push({
        measure,
        formFactor: run.formFactor,
        value,
        threshold,
        meetsUnderLocalConditions: value === null || min === null ? null : value >= min,
      });
    }
    const times: Array<[string, number | null, string, number]> = [
      ["largestContentfulPaint", run.metrics.largestContentfulPaintMs, t.loadTime.largestContentfulPaint, 2500],
      ["firstContentfulPaint", run.metrics.firstContentfulPaintMs, t.loadTime.firstContentfulPaint, 1800],
    ];
    for (const [measure, ms, threshold, maxMs] of times) {
      rows.push({
        measure,
        formFactor: run.formFactor,
        value: ms === null ? null : Math.round(ms),
        threshold: `${threshold} (${maxMs} ms)`,
        meetsUnderLocalConditions: ms === null ? null : ms <= maxMs,
      });
    }
  }
  return rows;
}

export const DISCLAIMERS = [
  "Community tool. Not affiliated with or endorsed by TDRA.",
  "Automated checks cover only a machine-checkable subset of the standard — a clean automated run is NOT compliance and NOT WCAG 2.1/2.2 AA conformance.",
  "Arabic/RTL parity findings are flags for native-speaker review; Mizan never asserts parity as settled.",
  "Lighthouse numbers were produced under the run conditions recorded in this report (local machine, simulated throttling) — they are comparable across local runs, not to TDRA's environment.",
  "This is a private report for the site's own team.",
];

export function buildReport(input: {
  target: string;
  page: AuditReport["page"];
  engines: Record<string, string>;
  findings: AuditFinding[];
  lighthouse: LighthouseScores[] | null;
  /** Whether the origin HTTP probes ran (http(s) targets only). Default: from the target scheme. */
  httpRan?: boolean;
  /** Whether the Tier D crawl reached at least one subpage. Default false. */
  crawlRan?: boolean;
  /** Whether the Tier C keyboard walk completed without aborting. Default true. */
  kbdRan?: boolean;
  /** Whether --entity-type ministry was passed (item 2.12). Default false. */
  ministryChecked?: boolean;
}): AuditReport {
  const byEngine: Record<string, number> = {};
  for (const f of input.findings) byEngine[f.engine] = (byEngine[f.engine] ?? 0) + 1;
  return {
    tool: { name: own.name, version: own.version },
    target: input.target,
    generatedAt: new Date().toISOString(),
    page: input.page,
    engines: input.engines,
    runConditions: {
      machine: `${process.platform} ${process.arch}, node ${process.version}`,
      note: "Local run — see the disclaimers before comparing numbers across environments.",
      lighthouse: input.lighthouse?.map((r) => r.runConditions) ?? null,
    },
    summary: {
      findingCount: input.findings.length,
      bySeverity: countBySeverity(input.findings),
      byEngine,
    },
    lighthouse: input.lighthouse
      ? {
          runs: input.lighthouse,
          thresholds: thresholdRows(input.lighthouse),
          thresholdSource: loadTdraCriteria().meta.pageStatedThresholds.provenance,
        }
      : null,
    tdraChecklist: buildChecklistView(input.findings, {
      lighthouseRan: input.lighthouse !== null,
      httpRan: input.httpRan ?? /^https?:/i.test(input.target),
      crawlRan: input.crawlRan ?? false,
      kbdRan: input.kbdRan ?? true,
      ministryChecked: input.ministryChecked ?? false,
    }),
    findings: input.findings,
    disclaimers: DISCLAIMERS,
  };
}

/** The human report: markdown shaped the way a TDRA reviewer reads. */
export function renderMarkdown(r: AuditReport): string {
  const lines: string[] = [];
  const s = r.summary.bySeverity;
  lines.push(`# Mizan audit — ${r.target}`);
  lines.push("");
  lines.push(`> ${r.tool.name}@${r.tool.version} · ${r.generatedAt} · ${r.runConditions.machine}`);
  lines.push(`> Page: HTTP ${r.page.status}, ${r.page.nodes} nodes in ${r.page.loadMs} ms — "${r.page.title}" (lang=${r.page.lang || "unset"} dir=${r.page.dir || "unset"})`);
  if (r.page.finalUrl && r.page.finalUrl !== r.target)
    lines.push(`> Final URL after redirects: ${r.page.finalUrl}`);
  lines.push("");
  lines.push(
    `**${r.summary.findingCount} finding(s)** — ${s.critical} critical, ${s.serious} serious, ` +
      `${s.moderate} moderate, ${s.minor} minor · engines: ` +
      Object.entries(r.engines)
        .map(([k, v]) => `${k} ${v}`)
        .join(", "),
  );
  lines.push("");

  if (r.lighthouse) {
    lines.push(`## Lighthouse vs TDRA thresholds (local run conditions)`);
    lines.push("");
    lines.push(`| Measure | Form factor | Value | TDRA threshold | Meets (local run)? |`);
    lines.push(`|---|---|---|---|---|`);
    for (const row of r.lighthouse.thresholds) {
      const meets =
        row.meetsUnderLocalConditions === null ? "n/a" : row.meetsUnderLocalConditions ? "yes" : "**no**";
      lines.push(`| ${row.measure} | ${row.formFactor} | ${row.value ?? "n/a"} | ${row.threshold} | ${meets} |`);
    }
    lines.push("");
    for (const rc of r.runConditions.lighthouse ?? [])
      lines.push(
        `- ${rc.formFactor}: ${rc.throttling}; screen ${rc.screenEmulation}` +
          (rc.chromeFlags ? `; chrome flags: ${rc.chromeFlags}` : ""),
      );
    lines.push("");
  }

  const c = r.tdraChecklist;
  lines.push(`## TDRA assessment checklist (v${c.source.version}, published ${c.source.published})`);
  lines.push("");
  lines.push(c.note);
  lines.push("");
  let section = "";
  for (const item of c.machineCheckedItems) {
    const meta = loadTdraCriteria().items.find((i) => i.id === item.id);
    if (meta && meta.section !== section) {
      section = meta.section;
      lines.push(`### ${section}`);
      lines.push("");
    }
    const mark = item.status === "findings" ? "✗" : item.status === "not-checked" ? "○" : "•";
    const status =
      item.status === "findings"
        ? `${item.findings.length} finding(s)`
        : item.status === "not-checked"
          ? "not checked in this run — its evidence engine did not run (see the checklist note)"
          : "no automated findings (subset only — not a pass)";
    lines.push(`- **${mark} ${item.id}** ${item.question}`);
    lines.push(`  - ${status}`);
    for (const f of item.findings.slice(0, 5)) {
      lines.push(`  - [${f.severity}|${f.confidence}] ${f.ruleId}: ${f.message.slice(0, 200)}${f.fix ? ` → fix: ${f.fix.slice(0, 150)}` : ""}`);
    }
    if (item.findings.length > 5) lines.push(`  - …and ${item.findings.length - 5} more`);
  }
  lines.push("");
  lines.push(`_${c.humanReviewCount} of ${c.totalItems} checklist items need human review (process/design questions outside automated scope)._`);
  lines.push("");

  const unmapped = r.findings.filter(
    (f) => !c.machineCheckedItems.some((i) => i.findings.includes(f)),
  );
  if (unmapped.length) {
    lines.push(`## Further findings (no single checklist item, still on-standard requirements)`);
    lines.push("");
    for (const f of unmapped) {
      lines.push(`- [${f.severity}|${f.confidence}] ${f.engine}/${f.ruleId}: ${f.message.slice(0, 250)}`);
    }
    lines.push("");
  }

  lines.push(`## Disclaimers`);
  lines.push("");
  for (const d of r.disclaimers) lines.push(`- ${d}`);
  lines.push("");
  return lines.join("\n");
}
