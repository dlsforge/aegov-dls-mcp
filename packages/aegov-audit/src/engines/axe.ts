/**
 * axe-core over the rendered page (STAGE2-HANDOFF §6 step 2).
 *
 * The pinned axe-core source is injected into the page via the devtools
 * protocol (page.evaluate of the source string — not <script> injection, so
 * the target site's CSP cannot silently block it) and run against the
 * document. Violations normalize into Mizan's AuditFinding shape.
 *
 * Coverage caution (STAGE2-HANDOFF §9): axe machine-checks only a subset of
 * WCAG 2.2 AA — a clean run is NOT compliance. The report layer must keep
 * saying so.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

const require = createRequire(import.meta.url);
const axePkg = require("axe-core/package.json") as { version: string };
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

export const AXE_VERSION: string = axePkg.version;

/** axe's impact vocabulary happens to be Mizan's severity vocabulary. */
function severityOf(impact: string | null | undefined): AuditSeverity {
  switch (impact) {
    case "critical":
    case "serious":
    case "moderate":
    case "minor":
      return impact;
    default:
      return "moderate"; // axe leaves impact null only on needs-review edge cases
  }
}

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

export async function runAxe(page: Page): Promise<AuditFinding[]> {
  await page.evaluate(AXE_SOURCE);
  const violations = (await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axe = (window as any).axe;
    const results = await axe.run(document, {
      resultTypes: ["violations"],
      reporter: "v1", // v1 keeps failureSummary on nodes
    });
    return results.violations;
  })) as AxeViolation[];

  return violations.map((v) => ({
    engine: "axe" as const,
    ruleId: v.id,
    severity: severityOf(v.impact),
    confidence: "external" as const,
    message: v.help,
    fix: v.nodes[0]?.failureSummary ?? null,
    helpUrl: v.helpUrl,
    tags: v.tags,
    targets: v.nodes.slice(0, 10).map((n) => n.target.join(" ")),
    nodeCount: v.nodes.length,
  }));
}
