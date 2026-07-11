/**
 * The DLS rules engine over the rendered DOM (STAGE2-HANDOFF §6 step 4) —
 * the differentiating value generic tools cannot provide.
 *
 * Consistency rule (§7): these are the SAME checks the MCP server's
 * validate_snippet enforces, imported from @dlsforge/aegov-rules-core —
 * never re-derived. A rule changes once in the core and both tools follow.
 *
 * This first slice runs the string-level rule engine over the serialized
 * rendered DOM (what Stage 1 could never see: the post-JavaScript document).
 * The rendered-only checks — token fidelity via computed styles (T4),
 * structural nesting (T5), UAE Pass presence, Arabic/RTL parity — layer on
 * top in later work; see the build log in STAGE2-HANDOFF §6.
 */
import {
  loadCatalog,
  buildClassIndex,
  checkClassIdentity,
  checkImgAlt,
  checkButtonType,
  checkFullEidValue,
  checkEmiratesIdInputs,
  checkMdyDates,
  checkArabicRtl,
  type ClassIndex,
  type Finding,
} from "@dlsforge/aegov-rules-core";
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

let cachedIndex: ClassIndex | null = null;
function classIndex(): ClassIndex {
  return (cachedIndex ??= buildClassIndex(loadCatalog()));
}

export function dlsPackageRef(): string {
  return classIndex().packageRef;
}

/** Stage 1 finding levels → Mizan severities. */
function severityOf(level: Finding["level"]): AuditSeverity {
  switch (level) {
    case "error":
      return "serious";
    case "warning":
      return "moderate";
    default:
      return "minor";
  }
}

/** A rendered gov page can carry thousands of unverified utility classes. */
function truncate(message: string, max = 500): string {
  return message.length <= max ? message : `${message.slice(0, max)}… (truncated)`;
}

export async function runDlsRules(page: Page): Promise<AuditFinding[]> {
  const index = classIndex();
  const html = (await page.evaluate(
    () => document.documentElement.outerHTML,
  )) as string;

  const checks: Array<[string, Finding[]]> = [
    ["dls-class-identity", checkClassIdentity(html, index).findings],
    ["dls-img-alt", checkImgAlt(html)],
    ["dls-button-type", checkButtonType(html)],
    ["dls-eid-unmasked", checkFullEidValue(html)],
    ["dls-eid-pattern", checkEmiratesIdInputs(html)],
    ["dls-dmy-dates", checkMdyDates(html)],
    ["dls-arabic-rtl", checkArabicRtl(html)],
  ];

  const findings: AuditFinding[] = [];
  for (const [ruleId, ruleFindings] of checks) {
    for (const f of ruleFindings) {
      findings.push({
        engine: "dls",
        ruleId,
        severity: severityOf(f.level),
        confidence: f.confidence,
        message: truncate(f.message),
        fix: null,
        helpUrl: null,
        tags: ["aegov-dls", index.packageRef],
        targets: [],
        nodeCount: 1,
      });
    }
  }
  return findings;
}
