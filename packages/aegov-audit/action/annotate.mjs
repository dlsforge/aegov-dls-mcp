#!/usr/bin/env node
/**
 * GitHub Action glue (STAGE2-HANDOFF §6 step 6): turn Mizan's report.json
 * into workflow annotations and step outputs. Findings at or above the
 * fail-on threshold annotate as errors, everything else as warnings —
 * "fail the build on critical findings, warn on the rest."
 *
 * Env (set by action.yml):
 *   MIZAN_REPORT_DIR  directory holding report.json + report.md
 *   MIZAN_FAIL_ON     critical|serious|moderate|minor|none
 *   GITHUB_OUTPUT     step-outputs file (absent when run outside Actions)
 *
 * The exit-code gate itself lives in the CLI (--fail-on) — this script only
 * reports; it always exits 0 so artifact upload and the summary still run.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEVERITY_ORDER = ["critical", "serious", "moderate", "minor"];
const MAX_ANNOTATIONS = 30;

// GitHub workflow-command escaping: %, CR, LF in messages; also : and , in properties.
const escData = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (s) => escData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

const dir = process.env.MIZAN_REPORT_DIR || "mizan-report";
const failOn = process.env.MIZAN_FAIL_ON || "critical";
const reportPath = resolve(dir, "report.json");

const setOutput = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};

if (!existsSync(reportPath)) {
  console.log(
    `::error::Mizan produced no report at ${escData(reportPath)} — the audit crashed before reporting; see the "Run Mizan audit" step log.`,
  );
  process.exit(0);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const bySeverity = report.summary.bySeverity;

setOutput("report-json", reportPath);
setOutput("report-md", resolve(dir, "report.md"));
setOutput("finding-count", report.summary.findingCount);
for (const sev of SEVERITY_ORDER) setOutput(sev, bySeverity[sev]);

const cut = SEVERITY_ORDER.indexOf(failOn); // -1 for "none" → everything is a warning
const findings = [...report.findings].sort(
  (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
);
let emitted = 0;
for (const f of findings) {
  if (emitted >= MAX_ANNOTATIONS) break;
  const kind = cut !== -1 && SEVERITY_ORDER.indexOf(f.severity) <= cut ? "error" : "warning";
  const title = escProp(`Mizan ${f.severity}: ${f.engine}/${f.ruleId}`);
  const message = escData(
    `${f.message}${f.fix ? ` — fix: ${f.fix}` : ""} [confidence: ${f.confidence}]`,
  );
  console.log(`::${kind} title=${title}::${message}`);
  emitted++;
}
if (findings.length > emitted) {
  console.log(
    `::notice::…and ${findings.length - emitted} more finding(s) — see the report artifact and the job summary.`,
  );
}
console.log(
  `::notice::Mizan: ${report.summary.findingCount} finding(s) — ` +
    `${bySeverity.critical} critical, ${bySeverity.serious} serious, ` +
    `${bySeverity.moderate} moderate, ${bySeverity.minor} minor. ` +
    `Automated checks cover a machine-checkable subset only — a clean run is NOT compliance.`,
);
