/**
 * Step-6 gate (STAGE2-HANDOFF §6): the CI surface. --fail-on turns findings
 * into exit codes ("fail the build on critical findings"); the action's
 * annotate.mjs turns report.json into annotations and outputs ("warn on the
 * rest"); action.yml keeps its contract. The full end-to-end action run lives
 * in .github/workflows/mizan-selftest.yml — these tests cover every piece
 * that can be exercised locally.
 *
 * Run: npm run build && node --test test/step6.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { countAtOrAbove, isFailOn, SEVERITY_ORDER } from "../dist/report/types.js";

const FIXTURE = "test/fixtures/seeded-a11y.html";
const runCli = (...args) =>
  spawnSync(process.execPath, ["dist/index.js", ...args], { encoding: "utf8", timeout: 120_000 });

describe("severity threshold (pure)", () => {
  const counts = { critical: 1, serious: 2, moderate: 3, minor: 4 };
  test("severities order most-severe first", () => {
    assert.deepEqual([...SEVERITY_ORDER], ["critical", "serious", "moderate", "minor"]);
  });
  test("counts accumulate downward along the order", () => {
    assert.equal(countAtOrAbove(counts, "critical"), 1);
    assert.equal(countAtOrAbove(counts, "serious"), 3);
    assert.equal(countAtOrAbove(counts, "moderate"), 6);
    assert.equal(countAtOrAbove(counts, "minor"), 10);
  });
  test("a lower-severity finding never trips a higher threshold", () => {
    assert.equal(countAtOrAbove({ critical: 0, serious: 0, moderate: 0, minor: 9 }, "serious"), 0);
  });
  test("isFailOn accepts the four severities and none, rejects junk", () => {
    for (const v of [...SEVERITY_ORDER, "none"]) assert.ok(isFailOn(v), v);
    assert.ok(!isFailOn("bogus"));
    assert.ok(!isFailOn(""));
  });
});

describe("--fail-on exit codes (CLI subprocess)", () => {
  test("an invalid threshold is a usage error: exit 2, before any browser work", () => {
    const r = runCli(FIXTURE, "--fail-on", "bogus");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--fail-on needs one of/);
  });

  test("seeded fixture at --fail-on critical exits 1 and says why (image-alt is critical)", () => {
    const r = runCli(FIXTURE, "--fail-on", "critical");
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /FAIL — \d+ finding\(s\) at or above "critical"/);
  });

  test("the same fixture at --fail-on none exits 0 — report-only stays the default behavior", () => {
    const r = runCli(FIXTURE, "--fail-on", "none");
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /FAIL/);
  });
});

describe("annotate.mjs — the action's report-to-annotations glue", () => {
  const ANNOTATE = resolve("action/annotate.mjs");
  const REPORT = {
    summary: { findingCount: 3, bySeverity: { critical: 0, serious: 1, moderate: 1, minor: 1 } },
    findings: [
      { engine: "dls", ruleId: "dls-x", severity: "moderate", confidence: "docs", message: "m1\nline2", fix: "f: a,b", helpUrl: null, tags: [], targets: [], nodeCount: 1 },
      { engine: "axe", ruleId: "axe-y", severity: "serious", confidence: "external", message: "m2 100%", fix: null, helpUrl: null, tags: [], targets: [], nodeCount: 1 },
      { engine: "dls", ruleId: "dls-z", severity: "minor", confidence: "package", message: "m3", fix: null, helpUrl: null, tags: [], targets: [], nodeCount: 1 },
    ],
  };
  const runAnnotate = (dir, failOn) => {
    const ghOutput = join(dir, "gh-output.txt");
    writeFileSync(ghOutput, "");
    const r = spawnSync(process.execPath, [ANNOTATE], {
      encoding: "utf8",
      env: { ...process.env, MIZAN_REPORT_DIR: dir, MIZAN_FAIL_ON: failOn, GITHUB_OUTPUT: ghOutput },
    });
    return { ...r, outputs: readFileSync(ghOutput, "utf8") };
  };

  test("findings at/above fail-on annotate as errors, the rest as warnings, most severe first", () => {
    const dir = mkdtempSync(join(tmpdir(), "mizan-annotate-"));
    writeFileSync(join(dir, "report.json"), JSON.stringify(REPORT));
    const r = runAnnotate(dir, "serious");
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split("\n");
    assert.match(lines[0], /^::error title=Mizan serious%3A axe\/axe-y::/);
    assert.match(lines[1], /^::warning title=Mizan moderate%3A dls\/dls-x::/);
    assert.match(lines[2], /^::warning title=Mizan minor%3A dls\/dls-z::/);
    assert.match(r.stdout, /a clean run is NOT compliance/i);
  });

  test("workflow-command escaping: newline %0A and percent %25 in messages", () => {
    const dir = mkdtempSync(join(tmpdir(), "mizan-annotate-"));
    writeFileSync(join(dir, "report.json"), JSON.stringify(REPORT));
    const r = runAnnotate(dir, "none");
    assert.match(r.stdout, /m1%0Aline2/);
    assert.match(r.stdout, /m2 100%25/);
    assert.ok(!r.stdout.includes("::error "), "fail-on none must not emit errors");
  });

  test("step outputs carry the counts and report paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "mizan-annotate-"));
    writeFileSync(join(dir, "report.json"), JSON.stringify(REPORT));
    const r = runAnnotate(dir, "serious");
    assert.match(r.outputs, /finding-count=3\n/);
    assert.match(r.outputs, /critical=0\n/);
    assert.match(r.outputs, /serious=1\n/);
    assert.match(r.outputs, /moderate=1\n/);
    assert.match(r.outputs, /minor=1\n/);
    assert.match(r.outputs, /report-json=.*report\.json\n/);
    assert.match(r.outputs, /report-md=.*report\.md\n/);
  });

  test("a missing report annotates the crash and still exits 0 (the gate step owns failure)", () => {
    const dir = mkdtempSync(join(tmpdir(), "mizan-annotate-"));
    const r = runAnnotate(dir, "critical");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^::error::Mizan produced no report/);
    assert.ok(!r.outputs.includes("finding-count"), "no outputs without a report");
  });
});

describe("action.yml contract (pinned — update deliberately)", () => {
  const yml = readFileSync(resolve("action/action.yml"), "utf8");
  test("composite action with the url input required and fail-on defaulting to critical", () => {
    assert.match(yml, /using: "composite"/);
    assert.match(yml, /url:\n[\s\S]{0,300}?required: true/);
    assert.match(yml, /fail-on:\n[\s\S]{0,400}?default: "critical"/);
  });
  test("inputs reach scripts only via env, never inline interpolation into run blocks", () => {
    // Script-injection guard: collect every line belonging to a `run:` value
    // (inline or block scalar) and allow ${{ }} there only for the constant
    // github.action_path.
    const lines = yml.split("\n");
    let blockIndent = -1; // indentation of the `run:` key while inside its block scalar
    for (const line of lines) {
      const runKey = line.match(/^(\s*)run:(.*)$/);
      const scriptParts = [];
      if (blockIndent !== -1) {
        if (line.trim() === "" || line.search(/\S/) > blockIndent) scriptParts.push(line);
        else blockIndent = -1;
      }
      if (runKey) {
        if (runKey[2].trim().startsWith("|")) blockIndent = runKey[1].length;
        else scriptParts.push(runKey[2]);
      }
      for (const part of scriptParts) {
        if (part.includes("${{")) {
          assert.match(part, /github\.action_path/, `unexpected interpolation in a run block: ${part.trim()}`);
        }
      }
    }
  });
  test("the pipeline keeps annotate, summary, artifact upload and the final gate", () => {
    assert.match(yml, /annotate\.mjs/);
    assert.match(yml, /GITHUB_STEP_SUMMARY/);
    assert.match(yml, /actions\/upload-artifact@v7/);
    assert.match(yml, /Enforce fail-on/);
  });
});
