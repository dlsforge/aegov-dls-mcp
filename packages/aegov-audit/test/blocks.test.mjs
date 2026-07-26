/**
 * Block conformance gate — TDRA 3.19–3.22 and 2.40, evaluated against the
 * docs-sourced contracts in @dlsforge/aegov-rules-core.
 *
 * Same contract as the other tier gates: a fixture built to the documented
 * header/footer trips nothing, seeded fixtures trip exactly the rule they
 * violate. The cases that matter most here are the NEGATIVE ones — a page with
 * no DLS header must report 3.20 as "not-checked" rather than passing or
 * failing a mobile menu that was never there to look at.
 *
 * Run: npm run build && node --test test/blocks.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { loadCatalog } from "@dlsforge/aegov-rules-core";
import { runBlockChecks, blockRuleId } from "../dist/engines/blocks.js";
import { buildChecklistView } from "../dist/report/tdra.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser;
before(async () => (browser = await chromium.launch()));
after(async () => await browser.close());

async function check(fixture) {
  const p = await browser.newPage();
  try {
    await p.route(/^https?:/, (route) => route.abort());
    await p.goto(fx(fixture));
    return await runBlockChecks(p);
  } finally {
    await p.close();
  }
}

const ruleIds = (r) => r.findings.map((f) => f.ruleId).sort();
const status = (view, id) => view.machineCheckedItems.find((i) => i.id === id)?.status;

describe("a page built to the documented blocks", () => {
  test("trips no block rule and leaves nothing unevaluated", async () => {
    const r = await check("blocks-compliant.html");
    assert.deepEqual(ruleIds(r), [], "compliant fixture must produce zero block findings");
    assert.deepEqual(r.notApplicableRules, [], "every requirement should have found its anchor");
  });

  test("its checklist rows read as checked, not skipped", async () => {
    const r = await check("blocks-compliant.html");
    const view = buildChecklistView(r.findings, { notApplicableRules: r.notApplicableRules });
    for (const id of ["3.19", "3.20", "3.21", "3.22", "2.40"]) {
      assert.equal(status(view, id), "no-automated-findings", id);
    }
  });
});

describe("seeded violations", () => {
  test("an 8-item navigation trips only the nav limit", async () => {
    const r = await check("blocks-seeded-nav.html");
    assert.deepEqual(ruleIds(r), ["blk-header-nav-max-items"]);
    const f = r.findings[0];
    assert.match(f.message, /8 top-level items \(limit 7\)/);
    assert.equal(f.severity, "serious");
    assert.equal(f.confidence, "docs", "block rules are docs-tier evidence, never package-tier");
    assert.match(f.helpUrl, /designsystem\.gov\.ae\/docs\/blocks\/header/);
  });

  test("a stale copyright year is caught; the footer is otherwise conformant", async () => {
    const r = await check("blocks-seeded-footer.html");
    assert.ok(ruleIds(r).includes("blk-footer-copyright-year"));
    assert.ok(!ruleIds(r).includes("blk-footer-root"));
    const f = r.findings.find((x) => x.ruleId === "blk-footer-copyright-year");
    assert.match(f.message, /2019/);
    assert.equal(f.severity, "moderate");
  });

  test("a footer with no mobile accordion trips 3.22", async () => {
    const r = await check("blocks-seeded-footer.html");
    assert.ok(ruleIds(r).includes("blk-footer-mobile-accordion"));
    const view = buildChecklistView(r.findings, { notApplicableRules: r.notApplicableRules });
    assert.equal(status(view, "3.22"), "findings");
  });
});

describe("a page not using the DLS blocks at all", () => {
  test("both roots are violations and the gated requirements are not evaluated", async () => {
    const r = await check("blocks-absent.html");
    assert.deepEqual(ruleIds(r), ["blk-footer-root", "blk-header-root"]);
    assert.deepEqual(r.notApplicableRules.sort(), [
      "blk-footer-copyright-year",
      "blk-footer-mobile-accordion",
      "blk-header-mobile-menu",
      "blk-header-nav-max-items",
    ]);
  });

  test("3.20 and 3.22 read not-checked — never a silent pass", async () => {
    const r = await check("blocks-absent.html");
    const view = buildChecklistView(r.findings, { notApplicableRules: r.notApplicableRules });
    assert.equal(status(view, "3.19"), "findings");
    assert.equal(status(view, "3.21"), "findings");
    assert.equal(status(view, "2.40"), "findings");
    // Nothing was there to judge for the mobile items; saying "no findings"
    // would read as a pass.
    assert.equal(status(view, "3.20"), "not-checked");
    assert.equal(status(view, "3.22"), "not-checked");
  });
});

describe("the design system's own documented markup", () => {
  // The sharpest test available: build a page out of the catalogue's captured
  // header and footer examples and check them against the contracts derived
  // from those very pages. If the docs' own markup fails its own contract, the
  // contract is wrong — not the site under audit.
  async function checkDocsMarkup(headerVariantIndex) {
    const catalog = loadCatalog();
    const header = catalog.blocks.find((b) => b.id === "header");
    const footer = catalog.blocks.find((b) => b.id === "footer");
    const headerExamples = [header.markup, ...header.examples].filter(Boolean);
    const html =
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>docs markup</title></head><body>` +
      headerExamples[headerVariantIndex].html +
      `<main><h1>Docs markup</h1></main>` +
      footer.markup.html +
      `</body></html>`;

    const p = await browser.newPage();
    try {
      await p.route(/^https?:/, (route) => route.abort());
      await p.setContent(html, { waitUntil: "domcontentloaded" });
      return await runBlockChecks(p);
    } finally {
      await p.close();
    }
  }

  // The one requirement a static code sample CANNOT demonstrate: the docs
  // mandate a copyright year that "auto change[s] every year", and their own
  // example hardcodes "© 2023". The rule is right and the sample is simply
  // illustrative — but an entity copying it verbatim does inherit a stale year,
  // which is precisely what the rule exists to catch. Pinned rather than
  // excluded so that if the docs ever ship a dynamic year, this test tells us.
  const STATIC_SAMPLE_ONLY = ["blk-footer-copyright-year"];

  test("the Ministries header + footer satisfy every structural contract", async () => {
    const r = await checkDocsMarkup(0);
    assert.deepEqual(
      ruleIds(r),
      STATIC_SAMPLE_ONLY,
      "the docs' own markup must not violate its own structural contract",
    );
    assert.deepEqual(r.notApplicableRules, [], "every anchor should be present in the docs markup");
  });

  test("the Authorities header variant satisfies every structural contract", async () => {
    const r = await checkDocsMarkup(1);
    assert.deepEqual(ruleIds(r), STATIC_SAMPLE_ONLY);
    assert.deepEqual(r.notApplicableRules, []);
  });

  test("the hardcoded year in the docs sample is what trips it, nothing else", async () => {
    const r = await checkDocsMarkup(0);
    const f = r.findings.find((x) => x.ruleId === "blk-footer-copyright-year");
    assert.match(f.message, /2023/, "the docs sample's hardcoded year should be named");
  });
});

describe("a catalogue with no block contracts", () => {
  test("every block item reads not-checked, never a silent pass", () => {
    // Regression: runBlockChecks returned no findings and no not-applicable
    // rules when the catalogue carried no contracts, so all five items read
    // "no automated findings" — a pass for something nothing had looked at.
    const view = buildChecklistView([], { blocksRan: false });
    for (const id of ["3.19", "3.20", "3.21", "3.22", "2.40"]) {
      assert.equal(status(view, id), "not-checked", id);
    }
  });

  test("the shipped catalogue does carry them, so a real run reports ran:true", async () => {
    const r = await check("blocks-compliant.html");
    assert.equal(r.ran, true);
  });
});

describe("rule-id mapping", () => {
  test("requirement ids become stable blk-* rule ids", () => {
    assert.equal(blockRuleId("header.nav-max-items"), "blk-header-nav-max-items");
    assert.equal(blockRuleId("footer.root"), "blk-footer-root");
  });
});
