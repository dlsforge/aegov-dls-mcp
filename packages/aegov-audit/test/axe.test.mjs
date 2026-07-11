/**
 * Step-2 gate (STAGE2-HANDOFF §6): axe-core wired over the rendered page.
 * The seeded fixture carries KNOWN defects — the engine must catch each one
 * and stay quiet on the valid controls.
 *
 * Run: npm run build && node --test test/axe.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runAxe } from "../dist/engines/axe.js";

let browser, page, findings;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto(pathToFileURL(resolve("test/fixtures/seeded-a11y.html")).href);
  findings = await runAxe(page);
});
after(async () => await browser.close());

describe("axe-core catches every seeded defect", () => {
  for (const ruleId of ["html-has-lang", "image-alt", "label", "color-contrast"]) {
    test(`seeded defect is caught: ${ruleId}`, () => {
      assert.ok(
        findings.some((f) => f.ruleId === ruleId),
        `expected a ${ruleId} violation; got: ${findings.map((f) => f.ruleId).join(", ")}`,
      );
    });
  }
});

describe("axe-core stays quiet on the valid controls", () => {
  test("the named button and the alt-ed image do not flag", () => {
    assert.ok(!findings.some((f) => f.ruleId === "button-name"));
    const imageAlt = findings.find((f) => f.ruleId === "image-alt");
    assert.equal(imageAlt.nodeCount, 1, "only the alt-less image may flag");
  });
});

describe("normalization into the AuditFinding shape", () => {
  test("every finding carries engine, severity, wcag tags, targets and a help url", () => {
    assert.ok(findings.length >= 4);
    for (const f of findings) {
      assert.equal(f.engine, "axe");
      assert.ok(["critical", "serious", "moderate", "minor"].includes(f.severity), f.ruleId);
      assert.equal(f.confidence, "external");
      assert.ok(f.message.length > 0);
      assert.ok(f.helpUrl.startsWith("https://"), f.ruleId);
      // axe rules are either WCAG-mapped or explicit best-practice checks
      assert.ok(
        Array.isArray(f.tags) &&
          f.tags.some((t) => /^wcag/.test(t) || t === "best-practice"),
        f.ruleId,
      );
      assert.ok(f.targets.length > 0 && f.nodeCount >= f.targets.length - 0, f.ruleId);
    }
  });

  test("image-alt maps to a critical severity with a failure summary as the fix", () => {
    const f = findings.find((x) => x.ruleId === "image-alt");
    assert.equal(f.severity, "critical");
    assert.ok(f.fix && f.fix.length > 0, "failureSummary must surface as fix");
  });
});
