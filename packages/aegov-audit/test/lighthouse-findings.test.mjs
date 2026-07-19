/**
 * Stage 2B Tier A gate: Lighthouse-derived checklist findings (items 3.43,
 * 3.46, 3.47, 3.53, 3.54, 3.58) and the not-checked honesty status.
 *
 * Pure-function tests — synthetic audit subsets, no Chrome. The audit ids
 * themselves were verified against the installed Lighthouse (see
 * PICKED_AUDIT_IDS in engines/lighthouse.ts).
 *
 * Run: npm run build && node --test test/lighthouse-findings.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  deriveLighthouseFindings,
  NON_IMAGE_BUDGET_BYTES,
  TOTAL_BUDGET_BYTES,
} from "../dist/engines/lighthouse-findings.js";
import { buildChecklistView } from "../dist/report/tdra.js";

const MB = 1024 * 1024;
const KB = 1024;

function run(formFactor, audits) {
  return {
    formFactor,
    scores: { performance: 50, accessibility: 90, bestPractices: 90, seo: 90 },
    metrics: { largestContentfulPaintMs: 2000, firstContentfulPaintMs: 1000 },
    audits,
    runConditions: {
      lighthouseVersion: "13.4.0",
      formFactor,
      throttling: "simulate",
      screenEmulation: "test",
      chromePath: "test",
      chromeFlags: "",
      note: "synthetic",
    },
  };
}

const audit = (id, over = {}) => ({
  id,
  score: null,
  scoreDisplayMode: "numeric",
  numericValue: null,
  displayValue: null,
  ...over,
});

describe("page-weight budgets (3.53 / 3.54) — explicit checklist numbers", () => {
  test("total-byte-weight over 4MB is a serious lh-page-weight-total finding", () => {
    const findings = deriveLighthouseFindings([
      run("mobile", { "total-byte-weight": audit("total-byte-weight", { numericValue: 5 * MB }) }),
    ]);
    const f = findings.find((x) => x.ruleId === "lh-page-weight-total");
    assert.ok(f, "finding expected");
    assert.equal(f.severity, "serious");
    assert.equal(f.engine, "lighthouse");
    assert.equal(f.confidence, "external");
    assert.match(f.message, /4 MB/);
    assert.match(f.message, /5\.00 MB/);
    assert.ok(f.tags.includes("mobile"));
  });

  test("under-budget total weight emits nothing", () => {
    const findings = deriveLighthouseFindings([
      run("mobile", {
        "total-byte-weight": audit("total-byte-weight", { numericValue: TOTAL_BUDGET_BYTES - 1 }),
      }),
    ]);
    assert.equal(findings.length, 0);
  });

  test("non-image weight over 500KB (resource-summary total minus image) fires 3.53", () => {
    const findings = deriveLighthouseFindings([
      run("desktop", {
        "resource-summary": audit("resource-summary", {
          scoreDisplayMode: "informative",
          resourceSizes: { total: 800 * KB, image: 200 * KB },
        }),
      }),
    ]);
    const f = findings.find((x) => x.ruleId === "lh-page-weight-no-images");
    assert.ok(f, "finding expected");
    assert.equal(f.severity, "serious");
    assert.match(f.message, /500 KB/);
    assert.match(f.message, /desktop 600 KB/);
  });

  test("non-image weight under budget emits nothing even when total is image-heavy", () => {
    const findings = deriveLighthouseFindings([
      run("desktop", {
        "resource-summary": audit("resource-summary", {
          scoreDisplayMode: "informative",
          resourceSizes: { total: 3 * MB, image: 3 * MB - NON_IMAGE_BUDGET_BYTES },
        }),
      }),
    ]);
    assert.equal(findings.length, 0);
  });

  test("resource-summary without an image row emits nothing (no evidence, no guess)", () => {
    const findings = deriveLighthouseFindings([
      run("desktop", {
        "resource-summary": audit("resource-summary", { resourceSizes: { total: 9 * MB } }),
      }),
    ]);
    assert.equal(findings.length, 0);
  });
});

describe("scored audits fail only below Lighthouse's 0.9 pass bar", () => {
  test("render-blocking-insight 0.3 → lh-render-blocking; 0.95 and null → nothing", () => {
    const fail = deriveLighthouseFindings([
      run("mobile", {
        "render-blocking-insight": audit("render-blocking-insight", {
          score: 0.3,
          displayValue: "Est savings of 450 ms",
        }),
      }),
    ]);
    assert.equal(fail.length, 1);
    assert.equal(fail[0].ruleId, "lh-render-blocking");
    assert.equal(fail[0].severity, "moderate");
    assert.match(fail[0].message, /450 ms/);

    for (const score of [0.95, null]) {
      const clean = deriveLighthouseFindings([
        run("mobile", {
          "render-blocking-insight": audit("render-blocking-insight", { score }),
        }),
      ]);
      assert.equal(clean.length, 0, `score ${score} must not fire`);
    }
  });

  test("unminified css/js map to separate rules; cache and third-party fire on failing score", () => {
    const findings = deriveLighthouseFindings([
      run("mobile", {
        "unminified-css": audit("unminified-css", { score: 0.4 }),
        "unminified-javascript": audit("unminified-javascript", { score: 0.5 }),
        "cache-insight": audit("cache-insight", { score: 0.2 }),
        "third-parties-insight": audit("third-parties-insight", { score: 0.1 }),
      }),
    ]);
    assert.deepEqual(findings.map((f) => f.ruleId).sort(), [
      "lh-cache-policy",
      "lh-third-party",
      "lh-unminified-css",
      "lh-unminified-javascript",
    ]);
  });

  test("a breach on one form factor is enough, and the finding names it", () => {
    const findings = deriveLighthouseFindings([
      run("mobile", { "cache-insight": audit("cache-insight", { score: 1 }) }),
      run("desktop", { "cache-insight": audit("cache-insight", { score: 0 }) }),
    ]);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].tags, ["lighthouse", "desktop"]);
  });

  test("absent audits emit nothing at all", () => {
    assert.equal(deriveLighthouseFindings([run("mobile", {})]).length, 0);
  });
});

describe("checklist honesty: not-checked vs no-automated-findings", () => {
  const LH_ONLY = ["3.43", "3.46", "3.47", "3.53", "3.54", "3.58"];

  test("without a Lighthouse run, Lighthouse-only items are not-checked (never a silent pass)", () => {
    const view = buildChecklistView([], { lighthouseRan: false });
    for (const id of LH_ONLY) {
      assert.equal(
        view.machineCheckedItems.find((i) => i.id === id).status,
        "not-checked",
        id,
      );
    }
    // non-Lighthouse items keep their meaning
    assert.equal(
      view.machineCheckedItems.find((i) => i.id === "3.24").status,
      "no-automated-findings",
    );
    assert.match(view.note, /not checked/);
  });

  test("with a Lighthouse run and no breaches, the same items are no-automated-findings", () => {
    const view = buildChecklistView([], { lighthouseRan: true });
    for (const id of LH_ONLY) {
      assert.equal(
        view.machineCheckedItems.find((i) => i.id === id).status,
        "no-automated-findings",
        id,
      );
    }
  });

  test("a derived finding lands on its checklist item (3.54)", () => {
    const findings = deriveLighthouseFindings([
      run("mobile", { "total-byte-weight": audit("total-byte-weight", { numericValue: 6 * MB }) }),
    ]);
    const view = buildChecklistView(findings, { lighthouseRan: true });
    const item = view.machineCheckedItems.find((i) => i.id === "3.54");
    assert.equal(item.status, "findings");
    assert.equal(item.findings.length, 1);
    assert.match(item.question, /below 4MB/);
  });
});
