/**
 * Stage 2B Tier A — derive normalized findings from the Lighthouse audits the
 * engine already collects, so they land on TDRA checklist items 3.43 / 3.46 /
 * 3.47 / 3.53 / 3.54 / 3.58 with direct evidence.
 *
 * Conservative by design (STAGE2B-HANDOFF §7, §9 — false positives are worse
 * than gaps):
 *  - an absent audit or null score emits NOTHING (no evidence ≠ clean);
 *  - opportunity/insight audits fail only below Lighthouse's own 0.9 pass bar;
 *  - the page-weight budgets come verbatim from the checklist questions
 *    (3.53 "below 500KB" excluding images, 3.54 "below 4MB" total), read as
 *    binary KB/MB (1024-based) — the stricter-to-breach reading — and the
 *    interpretation is stated in the finding message;
 *  - everything is derived from a LOCAL run; messages say so via the report's
 *    run-conditions block, and byte sizes are transfer sizes of THIS load.
 *
 * Pure function — unit-testable without Chrome.
 */
import type { AuditFinding } from "../report/types.js";
import type { LighthouseScores, PickedAudit } from "./lighthouse.js";

const KB = 1024;
const MB = 1024 * 1024;
/** Checklist item 3.53: page weight excluding images, "below 500KB". */
export const NON_IMAGE_BUDGET_BYTES = 500 * KB;
/** Checklist item 3.54: page weight with images, "below 4MB". */
export const TOTAL_BUDGET_BYTES = 4 * MB;
/** Lighthouse's own pass bar for scored audits. */
const PASS_SCORE = 0.9;

function fmtBytes(n: number): string {
  if (n >= MB) return `${(n / MB).toFixed(2)} MB`;
  return `${Math.round(n / KB)} KB`;
}

type PerRun = { formFactor: string; audit: PickedAudit };

function collect(runs: LighthouseScores[], id: string): PerRun[] {
  const out: PerRun[] = [];
  for (const run of runs) {
    const audit = run.audits?.[id];
    if (audit) out.push({ formFactor: run.formFactor, audit });
  }
  return out;
}

/** Scored audit below Lighthouse's pass bar on at least one form factor. */
function failingRuns(runs: PerRun[]): PerRun[] {
  return runs.filter(({ audit }) => audit.score !== null && audit.score < PASS_SCORE);
}

function finding(
  ruleId: string,
  severity: AuditFinding["severity"],
  message: string,
  fix: string | null,
  formFactors: string[],
): AuditFinding {
  return {
    engine: "lighthouse",
    ruleId,
    severity,
    confidence: "external",
    message,
    fix,
    helpUrl: null,
    tags: ["lighthouse", ...formFactors],
    targets: [],
    nodeCount: formFactors.length,
  };
}

function describePerRun(runs: PerRun[]): string {
  return runs
    .map(({ formFactor, audit }) => `${formFactor}: ${audit.displayValue ?? `score ${audit.score}`}`)
    .join("; ");
}

/**
 * One finding per failing audit, merged across form factors (a breach on
 * either mobile or desktop is a breach — TDRA assesses both).
 */
export function deriveLighthouseFindings(runs: LighthouseScores[]): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // 3.54 — total page weight, explicit checklist budget.
  {
    const perRun = collect(runs, "total-byte-weight").filter(
      ({ audit }) => audit.numericValue !== null,
    );
    const over = perRun.filter(({ audit }) => (audit.numericValue as number) > TOTAL_BUDGET_BYTES);
    if (over.length) {
      findings.push(
        finding(
          "lh-page-weight-total",
          "serious",
          `Total page weight exceeds the TDRA budget of 4 MB (checklist 3.54, read as ${fmtBytes(TOTAL_BUDGET_BYTES)}): ` +
            over
              .map(({ formFactor, audit }) => `${formFactor} ${fmtBytes(audit.numericValue as number)}`)
              .join(", ") +
            ". Transfer size of this local load.",
          "Reduce transferred bytes: compress/resize images, remove unused scripts and styles, enable text compression.",
          over.map((r) => r.formFactor),
        ),
      );
    }
  }

  // 3.53 — page weight excluding images, explicit checklist budget.
  {
    const perRun = collect(runs, "resource-summary").filter(
      ({ audit }) =>
        audit.resourceSizes !== undefined &&
        typeof audit.resourceSizes.total === "number" &&
        typeof audit.resourceSizes.image === "number",
    );
    const over = perRun
      .map(({ formFactor, audit }) => ({
        formFactor,
        nonImage: (audit.resourceSizes!.total as number) - (audit.resourceSizes!.image as number),
      }))
      .filter((r) => r.nonImage > NON_IMAGE_BUDGET_BYTES);
    if (over.length) {
      findings.push(
        finding(
          "lh-page-weight-no-images",
          "serious",
          `Page weight excluding images exceeds the TDRA budget of 500 KB (checklist 3.53): ` +
            over.map((r) => `${r.formFactor} ${fmtBytes(r.nonImage)}`).join(", ") +
            ". Transfer size of this local load, images subtracted.",
          "Trim non-image payload: split/defer JavaScript, remove unused CSS, subset fonts, enable text compression.",
          over.map((r) => r.formFactor),
        ),
      );
    }
  }

  // 3.43 — render-blocking CSS/JS.
  {
    const fails = failingRuns(collect(runs, "render-blocking-insight"));
    if (fails.length) {
      findings.push(
        finding(
          "lh-render-blocking",
          "moderate",
          `Render-blocking resources delay first paint (Lighthouse render-blocking-insight; ${describePerRun(fails)}).`,
          "Inline critical CSS, defer non-critical styles/scripts, or load them asynchronously so CSS is non-blocking.",
          fails.map((r) => r.formFactor),
        ),
      );
    }
  }

  // 3.46 — minification, CSS and JS separately.
  for (const [id, ruleId, what] of [
    ["unminified-css", "lh-unminified-css", "CSS"],
    ["unminified-javascript", "lh-unminified-javascript", "JavaScript"],
  ] as const) {
    const fails = failingRuns(collect(runs, id));
    if (fails.length) {
      findings.push(
        finding(
          ruleId,
          "moderate",
          `Unminified ${what} shipped to production (Lighthouse ${id}; ${describePerRun(fails)}).`,
          `Minify rendered ${what} in the production build pipeline.`,
          fails.map((r) => r.formFactor),
        ),
      );
    }
  }

  // 3.47 — cache policy on static assets.
  {
    const fails = failingRuns(collect(runs, "cache-insight"));
    if (fails.length) {
      findings.push(
        finding(
          "lh-cache-policy",
          "moderate",
          `Static assets served with inefficient cache lifetimes (Lighthouse cache-insight; ${describePerRun(fails)}).`,
          "Serve static assets with long-lived Cache-Control headers (fingerprinted filenames + max-age).",
          fails.map((r) => r.formFactor),
        ),
      );
    }
  }

  // 3.58 — third-party impact. Only when Lighthouse itself scores it failing —
  // mere presence of third parties is not a defect.
  {
    const fails = failingRuns(collect(runs, "third-parties-insight"));
    if (fails.length) {
      findings.push(
        finding(
          "lh-third-party",
          "moderate",
          `Third-party scripts materially impact load performance (Lighthouse third-parties-insight; ${describePerRun(fails)}).`,
          "Audit third-party tags: load them after the page is interactive, or drop the ones that aren't essential.",
          fails.map((r) => r.formFactor),
        ),
      );
    }
  }

  return findings;
}
