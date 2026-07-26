/**
 * Block conformance (TDRA 3.19–3.22, 2.40) — does the page use the approved
 * header and footer blocks as the design system documents them?
 *
 * The invariants themselves are NOT defined here. They live in
 * @dlsforge/aegov-rules-core as curated contracts bound to the docs page they
 * were authored from (each requirement cites the sentence or markup that
 * mandates it, verified verbatim at catalogue build time). This engine only
 * collects the selector evidence the contracts ask for and hands it back — the
 * same consistency rule the other DLS engines follow: a rule changes once in
 * the core, and every consumer follows.
 *
 * Zero-false-positive posture: every requirement is gated, and a gate that does
 * not match yields "not-applicable", which becomes a "not-checked" checklist row
 * rather than a pass or a guess. A malformed selector fails soft the same way
 * (fail-soft precedent: the keyboard walk in interaction.ts).
 */
import {
  loadCatalog,
  blockProbeSpec,
  checkBlockContracts,
  staleBlockContracts,
  groupKey,
  type BlockProbe,
  type BlockResult,
} from "@dlsforge/aegov-rules-core";
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

/** requirement id ("header.nav-max-items") -> Mizan ruleId ("blk-header-nav-max-items"). */
export function blockRuleId(requirementId: string): string {
  return `blk-${requirementId.replace(/\./g, "-")}`;
}

export type BlockCheckResult = {
  findings: AuditFinding[];
  /**
   * Rule ids whose requirement could not be evaluated on this page (the block or
   * the anchor it needs is absent). The checklist marks items evidenced ONLY by
   * these as "not-checked" — never "no automated findings".
   */
  notApplicableRules: string[];
};

export async function runBlockChecks(
  page: Page,
  opts: { now?: Date } = {},
): Promise<BlockCheckResult> {
  const contracts = loadCatalog().blockContracts;
  if (!contracts?.length) return { findings: [], notApplicableRules: [] };

  // Docs tier is provisional: if the source page moved since a contract was
  // authored, the catalogue is stale and its verdicts are not trustworthy.
  // Fail soft rather than assert stale rules against a live government site.
  const stale = staleBlockContracts(contracts);
  const fresh = contracts.filter((c) => !stale.includes(c));
  if (!fresh.length) {
    return {
      findings: [],
      notApplicableRules: contracts.flatMap((c) => c.requirements.map((r) => blockRuleId(r.id))),
    };
  }

  const spec = blockProbeSpec(fresh);
  // The group-count key is the library's to define, so compute it here with
  // rules-core's own helper and pass it into the page — never re-derive the
  // format inside the browser, where a change in the core would silently miss.
  const evalSpec = {
    present: spec.present,
    texts: spec.texts,
    groups: spec.groups.map((g) => ({ ...g, key: groupKey(g.groupSelector, g.childSelector) })),
  };
  const collected = await page.evaluate((s) => {
    const counts: Record<string, number> = {};
    const groupCounts: Record<string, number[]> = {};
    const texts: Record<string, string> = {};
    const failed: string[] = [];

    for (const sel of s.present) {
      try {
        counts[sel] = document.querySelectorAll(sel).length;
      } catch {
        failed.push(sel);
      }
    }
    for (const g of s.groups) {
      try {
        groupCounts[g.key] = Array.from(document.querySelectorAll(g.groupSelector)).map(
          (el) => el.querySelectorAll(g.childSelector).length,
        );
      } catch {
        failed.push(g.key);
      }
    }
    for (const sel of s.texts) {
      try {
        texts[sel] = Array.from(document.querySelectorAll(sel))
          .map((el) => el.textContent ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 4000);
      } catch {
        failed.push(sel);
      }
    }
    return { counts, groupCounts, texts, failed };
  }, evalSpec);

  const probe: BlockProbe = {
    counts: collected.counts,
    groupCounts: collected.groupCounts,
    texts: collected.texts,
    // The audit date, passed in explicitly so the library never reads a clock
    // and recorded runs stay reproducible.
    currentYear: (opts.now ?? new Date()).getFullYear(),
  };

  const results = checkBlockContracts(fresh, probe);
  const findings: AuditFinding[] = [];
  const notApplicableRules: string[] = [];

  for (const r of results) {
    const ruleId = blockRuleId(r.requirementId);
    if (r.status === "not-applicable") {
      notApplicableRules.push(ruleId);
      continue;
    }
    if (r.status === "satisfied") continue;
    findings.push(toFinding(r, ruleId));
  }
  // Contracts dropped as stale, and selectors the browser rejected, are absent
  // evidence — not silent passes.
  for (const c of stale) {
    for (const req of c.requirements) notApplicableRules.push(blockRuleId(req.id));
  }

  return { findings, notApplicableRules };
}

function toFinding(r: BlockResult, ruleId: string): AuditFinding {
  const severity: AuditSeverity = r.severity === "error" ? "serious" : "moderate";
  return {
    engine: "dls",
    ruleId,
    severity,
    // Docs tier: the block markup and its rules do not ship in the npm package,
    // so this is best-effort evidence against the documented standard.
    confidence: "docs",
    message: r.message ?? "",
    fix: r.fix ?? null,
    helpUrl: r.sourceUrl,
    tags: ["dls", "block", r.blockId],
    targets: [],
    nodeCount: 1,
  };
}
