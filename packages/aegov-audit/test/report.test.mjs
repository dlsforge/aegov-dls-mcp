/**
 * Step-5 gate (STAGE2-HANDOFF §6): document-meta checks + report aggregation
 * shaped to mirror the official TDRA assessment checklist v2.0 (the committed
 * reference extraction). Threshold evaluation uses synthetic Lighthouse
 * scores — the wiring is tested; the numbers come from real runs.
 *
 * Run: npm run build && node --test test/report.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runMetaChecks } from "../dist/engines/meta.js";
import { runUaePassCheck } from "../dist/engines/uaepass.js";
import { buildReport, renderMarkdown, DISCLAIMERS } from "../dist/report/report.js";
import { buildChecklistView, loadTdraCriteria } from "../dist/report/tdra.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser;
before(async () => (browser = await chromium.launch()));
after(async () => await browser.close());

const PAGE = { status: 200, loadMs: 10, nodes: 10, title: "t", lang: "en", dir: "ltr" };
const SYNTH_LH = [
  {
    formFactor: "mobile",
    scores: { performance: 62, accessibility: 99, bestPractices: 92, seo: 92 },
    metrics: { largestContentfulPaintMs: 3100, firstContentfulPaintMs: 1500 },
    runConditions: {
      lighthouseVersion: "13.4.0",
      formFactor: "mobile",
      throttling: "simulate (Lighthouse default for mobile)",
      screenEmulation: "412x823@1.75 mobile",
      chromePath: "test",
      note: "synthetic",
    },
  },
];

describe("document-meta checks answer checklist items 3.26-3.35", () => {
  test("seeded-a11y fixture: lang missing is serious; alternate/canonical flagged as review", async () => {
    const p = await browser.newPage();
    await p.goto(fx("seeded-a11y.html"));
    const findings = await runMetaChecks(p);
    await p.close();
    const ids = findings.map((f) => f.ruleId);
    assert.ok(ids.includes("meta-lang"));
    assert.equal(findings.find((f) => f.ruleId === "meta-lang").severity, "serious");
    assert.ok(ids.includes("meta-viewport"));
    assert.ok(ids.includes("meta-alternate"));
    assert.ok(!ids.includes("meta-doctype"), "fixture has the HTML5 doctype");
    assert.ok(!ids.includes("meta-charset"), "fixture declares utf-8");
  });
});

describe("TDRA checklist mirror", () => {
  test("reference extraction is present: v2.0, 125 items, 3 sections", () => {
    const c = loadTdraCriteria();
    assert.equal(c.meta.version, "2.0");
    assert.equal(c.items.length, 125);
    assert.equal(c.sections.length, 3);
  });

  test("a UAE Pass finding lands on checklist item 3.24", async () => {
    const p = await browser.newPage();
    await p.goto(fx("seeded-step4.html"));
    const findings = await runUaePassCheck(p);
    await p.close();
    const view = buildChecklistView(findings);
    const item = view.machineCheckedItems.find((i) => i.id === "3.24");
    assert.equal(item.status, "findings");
    assert.equal(item.findings.length, 1);
    assert.match(item.question, /UAE Pass as the primary login/);
  });

  test("clean input yields no-automated-findings, never a pass claim", () => {
    const view = buildChecklistView([]);
    assert.deepEqual(
      view.machineCheckedItems.map((i) => i.id),
      // prettier-ignore
      ["2.35", "2.42", "3.2", "3.4", "3.6", "3.8", "3.9", "3.10", "3.12", "3.23", "3.24", "3.26", "3.27",
       "3.28", "3.30", "3.31", "3.32", "3.33", "3.34", "3.35", "3.36", "3.37", "3.38", "3.39", "3.41",
       "3.43", "3.46", "3.47", "3.48", "3.49", "3.50", "3.51", "3.52", "3.53", "3.54", "3.57", "3.58",
       "3.59", "3.64"],
      "the curated machine-checkable set — update deliberately when a new engine lands",
    );
    // Without a Lighthouse run or an http(s) target, the items evidenced only
    // by those engines are "not-checked"; everything else ran and reads
    // "no-automated-findings". Neither is a pass.
    const notRun = new Set([
      "3.43", "3.46", "3.47", "3.53", "3.54", "3.58", // lighthouse-only
      "2.42", "3.38", "3.64", // http-probe-only
    ]);
    assert.ok(
      view.machineCheckedItems.every(
        (i) => i.status === (notRun.has(i.id) ? "not-checked" : "no-automated-findings"),
      ),
    );
    assert.match(view.note, /NOT a pass/);
    assert.equal(view.totalItems, 125);
    assert.equal(view.humanReviewCount + view.machineCheckedItems.length, 125);
  });
});

describe("report aggregation", () => {
  test("thresholds evaluate under the local-run caveat (perf 62 fails, a11y 99 passes, LCP 3100ms fails)", () => {
    const r = buildReport({ target: "https://example.gov.ae", page: PAGE, engines: {}, findings: [], lighthouse: SYNTH_LH });
    const row = (m) => r.lighthouse.thresholds.find((t) => t.measure === m);
    assert.equal(row("performance").meetsUnderLocalConditions, false);
    assert.equal(row("accessibility").meetsUnderLocalConditions, true);
    assert.equal(row("bestPractices").meetsUnderLocalConditions, true);
    assert.equal(row("largestContentfulPaint").meetsUnderLocalConditions, false);
    assert.equal(row("firstContentfulPaint").meetsUnderLocalConditions, true);
  });

  test("the markdown report carries checklist shape, run conditions and every disclaimer", () => {
    const r = buildReport({
      target: "https://example.gov.ae",
      page: PAGE,
      engines: { axe: "4.12.1", dls: "@aegov/design-system@3.0.7" },
      findings: [
        {
          engine: "dls", ruleId: "dls-uaepass-missing", severity: "serious", confidence: "heuristic",
          message: "login without UAE Pass", fix: "Integrate UAE Pass", helpUrl: null,
          tags: [], targets: [], nodeCount: 1,
        },
      ],
      lighthouse: SYNTH_LH,
    });
    const md = renderMarkdown(r);
    assert.match(md, /# Mizan audit/);
    assert.match(md, /TDRA assessment checklist \(v2\.0, published 2023-09-26\)/);
    assert.match(md, /3\.24.*UAE Pass as the primary login/);
    assert.match(md, /Lighthouse vs TDRA thresholds \(local run conditions\)/);
    assert.match(md, /simulate \(Lighthouse default for mobile\)/);
    for (const d of DISCLAIMERS) assert.ok(md.includes(d), d.slice(0, 40));
  });
});
