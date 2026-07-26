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

describe("rule-id mapping", () => {
  test("requirement ids become stable blk-* rule ids", () => {
    assert.equal(blockRuleId("header.nav-max-items"), "blk-header-nav-max-items");
    assert.equal(blockRuleId("footer.root"), "blk-footer-root");
  });
});
