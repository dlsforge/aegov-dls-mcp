/**
 * Stage 2C gate — the zero-false-positive slice: 3.40 offline W3C-style
 * validation, 3.42/3.15 breakpoint overflow, 3.60/3.61 monolithic-CMS
 * fingerprint, 2.21 icon library, 1.1/3.1 via dls-not-used.
 *
 * Same contract as the tier gates: seeded fixtures trip every rule, clean
 * fixtures trip none. Plus a breakpoint drift-guard against the installed
 * tailwindcss (the toolchain the DLS plugin compiles against).
 *
 * Run: npm run build && node --test test/stage2c.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runStackChecks } from "../dist/engines/stack.js";
import { runHtmlValidation } from "../dist/engines/validate-html.js";
import { runBreakpointCheck, DLS_BREAKPOINTS } from "../dist/engines/interaction.js";
import { buildChecklistView } from "../dist/report/tdra.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser;
before(async () => (browser = await chromium.launch()));
after(async () => await browser.close());

async function withPage(fixture, fn) {
  const p = await browser.newPage();
  try {
    await p.goto(fx(fixture));
    return await fn(p);
  } finally {
    await p.close();
  }
}

describe("3.40 — offline HTML validation of the raw source", () => {
  test("seeded fixture reports its source errors", async () => {
    const { findings, ran } = await runHtmlValidation(fx("seeded-w3c.html"));
    assert.equal(ran, true);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, "w3c-invalid-html");
    assert.match(findings[0].message, /no-dup-id/);
    assert.ok(findings[0].nodeCount >= 3, `nodeCount ${findings[0].nodeCount}`);
  });
  test("clean fixtures validate with zero findings", async () => {
    for (const f of ["clean-styles.html", "clean-assets.html"]) {
      const { findings, ran } = await runHtmlValidation(fx(f));
      assert.equal(ran, true, f);
      assert.deepEqual(findings, [], f);
    }
  });
  test("an unreachable source is ran=false, never a guess", async () => {
    const { findings, ran } = await runHtmlValidation("https://127.0.0.1:1/nothing");
    assert.equal(ran, false);
    assert.deepEqual(findings, []);
  });
});

describe("3.42 — breakpoint overflow sweep", () => {
  test("the fixed-width fixture overflows at the narrow breakpoints", async () => {
    const findings = await withPage("seeded-interaction.html", (p) => runBreakpointCheck(p));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, "ix-breakpoint-overflow");
    assert.match(findings[0].message, /sm \(640px/);
    assert.ok(!findings[0].targets.includes("1536px"), "1200px content fits at 2xl");
  });
  test("fluid layouts stay silent", async () => {
    const findings = await withPage("clean-styles.html", (p) => runBreakpointCheck(p));
    assert.deepEqual(findings, []);
  });
  test("drift guard: breakpoints match the installed tailwindcss theme", () => {
    const themePath = resolve("../../node_modules/tailwindcss/theme.css");
    if (!existsSync(themePath)) return; // published-package installs have no toolchain
    const theme = readFileSync(themePath, "utf8");
    for (const bp of DLS_BREAKPOINTS) {
      const m = theme.match(new RegExp(`--breakpoint-${bp.name}:\\s*([\\d.]+)rem`));
      assert.ok(m, `--breakpoint-${bp.name} missing from tailwindcss theme.css`);
      assert.equal(Number(m[1]) * 16, bp.width, `breakpoint ${bp.name} drifted`);
    }
  });
});

describe("3.60/3.61 + 2.21 — technology fingerprints (hard signals only)", () => {
  test("generator meta + Font Awesome fire on the seeded fixture", async () => {
    const findings = await withPage("seeded-stack.html", (p) => runStackChecks(p));
    const ids = findings.map((f) => f.ruleId).sort();
    assert.deepEqual(ids, ["stack-icon-library", "stack-monolithic-cms"]);
    const cms = findings.find((f) => f.ruleId === "stack-monolithic-cms");
    assert.match(cms.message, /WordPress/i);
    const icons = findings.find((f) => f.ruleId === "stack-icon-library");
    assert.match(icons.message, /Font Awesome/);
    assert.match(icons.message, /Phosphor/);
    assert.equal(icons.confidence, "docs");
  });
  test("no signal → no finding (clean fixtures)", async () => {
    for (const f of ["clean-styles.html", "clean-assets.html"]) {
      const findings = await withPage(f, (p) => runStackChecks(p));
      assert.deepEqual(findings.map((x) => x.ruleId), [], f);
    }
  });
  test("wp-content/uploads alone (proxied media) does NOT fingerprint a CMS", async () => {
    const p = await browser.newPage();
    try {
      await p.setContent(
        '<main><img src="https://cdn.example.org/wp-content/uploads/hero.jpg" alt="hero"></main>',
      );
      const findings = await runStackChecks(p);
      assert.deepEqual(findings.map((f) => f.ruleId), []);
    } finally {
      await p.close();
    }
  });
});

describe("checklist wiring for Stage 2C", () => {
  test("coverage reached 61 machine-checked items", () => {
    const view = buildChecklistView([], {});
    assert.equal(view.machineCheckedItems.length, 61);
  });
  test("3.40 is not-checked until the validator ran; stack/breakpoint items always run", () => {
    const closed = buildChecklistView([], { lighthouseRan: true, httpRan: true });
    const status = (v, id) => v.machineCheckedItems.find((i) => i.id === id).status;
    assert.equal(status(closed, "3.40"), "not-checked");
    const open = buildChecklistView([], { lighthouseRan: true, httpRan: true, htmlValidateRan: true });
    assert.equal(status(open, "3.40"), "no-automated-findings");
    for (const id of ["1.1", "3.1", "2.21", "3.15", "3.42", "3.60", "3.61"]) {
      assert.equal(status(closed, id), "no-automated-findings", id);
    }
  });
  test("dls-not-used evidences 1.1 and 3.1, not only 3.6", async () => {
    const finding = {
      engine: "dls",
      ruleId: "dls-not-used",
      severity: "serious",
      confidence: "heuristic",
      message: "no aegov-* classes",
      fix: null,
      helpUrl: null,
      tags: [],
      targets: ["html"],
      nodeCount: 1,
    };
    const view = buildChecklistView([finding], {});
    for (const id of ["1.1", "3.1", "3.6"]) {
      assert.equal(view.machineCheckedItems.find((i) => i.id === id).status, "findings", id);
    }
  });
});
