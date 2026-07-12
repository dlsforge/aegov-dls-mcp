#!/usr/bin/env node
/**
 * Mizan eval harness (STAGE2-HANDOFF §6 step 7 — the exit test, §3).
 *
 * Each fixture directory under evals/fixtures/ carries an expected.json:
 *   target     HTML file to audit (relative to the fixture dir)
 *   parity     optional other-language file → --parity
 *   expected   findings that MUST fire: { ruleId, severity?, minCount? }
 *   forbidden  ruleIds that must NOT fire (stays-quiet proof)
 *   maxFindings optional cap on total findings (0 for the compliant fixture)
 *
 * The harness drives the REAL CLI (node dist/index.js <target> --json) — the
 * same surface users and CI run — and compares report.findings against the
 * expectation. Iterate the RULES ENGINE until these pass; never hand-edit a
 * report (§3).
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES = resolve(ROOT, "evals/fixtures");

const fixtures = readdirSync(FIXTURES).filter((d) =>
  existsSync(join(FIXTURES, d, "expected.json")),
);
if (fixtures.length === 0) {
  console.error("run-evals: no fixtures found");
  process.exit(2);
}

let passCount = 0;
const failures = [];

for (const name of fixtures.sort()) {
  const dir = join(FIXTURES, name);
  const spec = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));
  const args = ["dist/index.js", join(dir, spec.target), "--json"];
  if (spec.parity) args.push("--parity", join(dir, spec.parity));

  const run = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0 || !run.stdout.trim()) {
    failures.push(`${name}: CLI failed (exit ${run.status}): ${run.stderr.slice(0, 400)}`);
    console.log(`FAIL  ${name} — CLI did not produce a report`);
    continue;
  }
  const report = JSON.parse(run.stdout);
  const findings = report.findings;
  const problems = [];

  for (const exp of spec.expected ?? []) {
    const matches = findings.filter((f) => f.ruleId === exp.ruleId);
    const min = exp.minCount ?? 1;
    if (matches.length < min) {
      problems.push(`MISSED expected ${exp.ruleId} (want >=${min}, got ${matches.length})`);
    } else if (exp.severity && !matches.some((f) => f.severity === exp.severity)) {
      problems.push(
        `expected ${exp.ruleId} at severity ${exp.severity}, got ${matches.map((f) => f.severity).join(",")}`,
      );
    }
  }
  for (const ruleId of spec.forbidden ?? []) {
    const hit = findings.filter((f) => f.ruleId === ruleId);
    if (hit.length) {
      problems.push(
        `FABRICATED forbidden ${ruleId} ×${hit.length}: ${hit[0].message.slice(0, 140)}`,
      );
    }
  }
  if (typeof spec.maxFindings === "number" && findings.length > spec.maxFindings) {
    problems.push(
      `too noisy: ${findings.length} finding(s) > max ${spec.maxFindings}: ` +
        findings.map((f) => `${f.ruleId}[${f.severity}]`).join(", "),
    );
  }

  if (problems.length === 0) {
    passCount++;
    console.log(
      `PASS  ${name} — ${findings.length} finding(s), ` +
        `${spec.expected?.length ?? 0} expectation(s) met, ` +
        `${spec.forbidden?.length ?? 0} forbidden rule(s) quiet`,
    );
  } else {
    console.log(`FAIL  ${name}`);
    for (const p of problems) console.log(`      ${p}`);
    failures.push(`${name}: ${problems.join("; ")}`);
  }
}

console.log(`\n${passCount}/${fixtures.length} eval fixtures pass`);
if (failures.length) {
  console.log("Iterate the rules engine (never the reports) until these pass.");
  process.exit(1);
}
