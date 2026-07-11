/**
 * Step-4 (first slice) gate: the rules-core DLS checks run over the RENDERED
 * DOM — including a defect injected by JavaScript that exists only after
 * render, which Stage 1's source-string validation could never see.
 *
 * Run: npm run build && node --test test/dls.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runDlsRules, dlsPackageRef } from "../dist/engines/dls.js";

let browser, findings;

before(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve("test/fixtures/seeded-dls.html")).href);
  findings = await runDlsRules(page);
});
after(async () => await browser.close());

const byRule = (ruleId) => findings.filter((f) => f.ruleId === ruleId);

describe("DLS rules over the rendered DOM catch every seeded defect", () => {
  test("unknown aegov-* class errors (package tier)", () => {
    const hits = byRule("dls-class-identity").filter((f) =>
      f.message.includes("aegov-fancy-button"),
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].severity, "serious");
    assert.equal(hits[0].confidence, "package");
  });

  test("the JS-injected drift class is caught — rendered-DOM-only, invisible to Stage 1", () => {
    const hits = byRule("dls-class-identity").filter((f) =>
      f.message.includes("aegov-pagination-larger"),
    );
    assert.equal(hits.length, 1);
    assert.match(hits[0].message, /does NOT ship/);
  });

  test("unmasked Emirates ID, missing EID pattern, MDY date and Arabic-without-RTL all flag", () => {
    assert.equal(byRule("dls-eid-unmasked").length, 1);
    assert.equal(byRule("dls-eid-pattern").length, 1);
    assert.equal(byRule("dls-dmy-dates").length, 1);
    assert.equal(byRule("dls-arabic-rtl").length, 1);
  });
});

describe("consistency with the shared core", () => {
  test("findings carry the pinned package ref and confidence tiers", () => {
    assert.match(dlsPackageRef(), /^@aegov\/design-system@\d/);
    for (const f of findings) {
      assert.equal(f.engine, "dls");
      assert.ok(["package", "docs", "heuristic"].includes(f.confidence), f.ruleId);
      assert.ok(f.tags.includes(dlsPackageRef()), f.ruleId);
    }
  });

  test("the valid aegov-btn control raises no class error", () => {
    const classErrors = byRule("dls-class-identity").filter((f) =>
      f.message.includes("'aegov-btn'"),
    );
    assert.deepEqual(classErrors, []);
  });
});
