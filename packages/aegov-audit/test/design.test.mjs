/**
 * Design-conformance gate: the checklist items the rendered page settles on
 * its own (1.15, 2.28, 2.31, 2.33, 3.5, 3.44, 3.45).
 *
 * Same contract as the other tier gates — the seeded fixture must trip EVERY
 * rule and the clean fixture must trip NONE (the false-positive gate) — plus
 * the not-applicable contract: a page with no form, no prose links or no
 * readable CSS must report those rules as unanswerable rather than clean.
 *
 * Run: npm run build && node --test test/design.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runDesignChecks } from "../dist/engines/design.js";
import { buildChecklistView } from "../dist/report/tdra.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser;
before(async () => (browser = await chromium.launch()));
after(async () => await browser.close());

async function onFixture(name) {
  const p = await browser.newPage();
  try {
    await p.route(/^https?:/, (route) => route.abort()); // hermetic
    await p.goto(fx(name));
    return await runDesignChecks(p);
  } finally {
    await p.close();
  }
}

async function onContent(html) {
  const p = await browser.newPage();
  try {
    await p.setContent(html);
    return await runDesignChecks(p);
  } finally {
    await p.close();
  }
}

describe("seeded fixture trips every design rule", () => {
  let ids, findings;
  before(async () => {
    ({ findings } = await onFixture("seeded-design.html"));
    ids = findings.map((f) => f.ruleId);
  });
  for (const rule of [
    "design-action-affordance",
    "design-site-boxed",
    "design-form-components",
    "design-graceful-degradation",
    "design-mobile-first",
    "design-british-english",
  ]) {
    test(`${rule} fires`, () => assert.ok(ids.includes(rule), ids.join(",")));
  }

  test("messages carry the concrete evidence, not a bare verdict", () => {
    const by = Object.fromEntries(findings.map((f) => [f.ruleId, f]));
    assert.match(by["design-mobile-first"].message, /max-width/);
    assert.match(by["design-site-boxed"].message, /wrapper/);
    assert.match(by["design-british-english"].message, /colou?r|centre|organis/i);
  });
});

describe("clean fixture trips none (false-positive gate)", () => {
  test("no findings at all", async () => {
    const { findings } = await onFixture("clean-design.html");
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });

  test("and nothing is silently skipped — every rule had its anchor", async () => {
    const { notApplicableRules } = await onFixture("clean-design.html");
    assert.deepEqual(notApplicableRules, []);
  });
});

describe("not-applicable, never a false pass", () => {
  test("a page with no form cannot evidence 2.33", async () => {
    const { notApplicableRules } = await onContent(
      "<html lang='en'><body><p>No form here at all.</p></body></html>",
    );
    assert.ok(notApplicableRules.includes("design-form-components"), notApplicableRules.join(","));
  });

  test("a page with no prose links cannot evidence 2.31", async () => {
    const { notApplicableRules } = await onContent(
      "<html lang='en'><body><button>Only a button</button></body></html>",
    );
    assert.ok(notApplicableRules.includes("design-action-affordance"));
  });

  test("a page with no readable stylesheet cannot evidence 2.28", async () => {
    const { notApplicableRules } = await onContent("<html lang='en'><body><p>Bare.</p></body></html>");
    assert.ok(notApplicableRules.includes("design-mobile-first"));
  });

  test("Arabic copy cannot evidence the British-English item", async () => {
    const { notApplicableRules, findings } = await onContent(
      "<html lang='ar' dir='rtl'><body><p>هذه صفحة عربية بالكامل ولا تحتوي على نص إنجليزي.</p></body></html>",
    );
    assert.ok(notApplicableRules.includes("design-british-english"));
    assert.ok(!findings.some((f) => f.ruleId === "design-british-english"));
  });

  test("those rules land on their items as not-checked, not as clean", async () => {
    const { notApplicableRules } = await onContent(
      "<html lang='ar' dir='rtl'><body><p>عربي فقط.</p></body></html>",
    );
    const view = buildChecklistView([], { notApplicableRules });
    const status = (id) => view.machineCheckedItems.find((i) => i.id === id).status;
    assert.equal(status("1.15"), "not-checked");
    assert.equal(status("2.33"), "not-checked");
  });
});

describe("a stale browser notice is not the same as having one", () => {
  test("a notice naming 2010-era browsers flags as stale", async () => {
    // The real fujmun.gov.ae footer shape.
    const { findings } = await onContent(
      "<html lang='en'><body><footer>Best viewed at 1280x1024 supporting Microsoft Edge, " +
        "Firefox 10+, Chrome 5+, Safari 1+, Opera 12+</footer></body></html>",
    );
    const ids = findings.map((f) => f.ruleId);
    assert.ok(ids.includes("design-browser-notice-stale"), ids.join(","));
  });

  test("a current-sounding notice is accepted", async () => {
    const { findings } = await onContent(
      "<html lang='en'><body><div>Your browser is not supported — please update your browser.</div></body></html>",
    );
    const ids = findings.map((f) => f.ruleId);
    assert.ok(!ids.includes("design-browser-notice-stale"));
  });
});
