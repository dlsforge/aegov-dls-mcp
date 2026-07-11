/**
 * Mizan's normalized finding shape — every engine (axe-core, Lighthouse, the
 * DLS rules from @dlsforge/aegov-rules-core) reduces to this so report
 * aggregation (STAGE2-HANDOFF §6 step 5) merges one stream.
 *
 * Confidence reuses Stage 1's tiers for DLS findings (package | docs |
 * heuristic — a docs-tier finding is best-effort evidence, never certainty);
 * findings from external engines carry "external" and inherit that engine's
 * own confidence semantics.
 */

export type AuditSeverity = "critical" | "serious" | "moderate" | "minor";

export type AuditFinding = {
  engine: "axe" | "lighthouse" | "dls";
  ruleId: string;
  severity: AuditSeverity;
  confidence: "package" | "docs" | "heuristic" | "external";
  message: string;
  /** How to fix it, when the engine provides guidance. */
  fix: string | null;
  helpUrl: string | null;
  /** Engine tags — for axe these include the WCAG mappings (wcag2aa, wcag412…). */
  tags: string[];
  /** CSS selectors of affected nodes (capped at 10 in transit). */
  targets: string[];
  /** Affected-node count before capping. */
  nodeCount: number;
};

export function countBySeverity(findings: AuditFinding[]): Record<AuditSeverity, number> {
  const counts: Record<AuditSeverity, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const f of findings) counts[f.severity]++;
  return counts;
}
