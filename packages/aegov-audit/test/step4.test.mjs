/**
 * Step-4 rendered-DOM engines (STAGE2-HANDOFF §6 step 4): token fidelity
 * (T4), component structure (T5), UAE Pass presence, Arabic/RTL parity.
 * Seeded fixtures — every defect is known; controls prove silence.
 *
 * Run: npm run build && node --test test/step4.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runTokenFidelity } from "../dist/engines/tokens.js";
import { runStructureChecks } from "../dist/engines/structure.js";
import { runUaePassCheck } from "../dist/engines/uaepass.js";
import { runParityCheck } from "../dist/engines/parity.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser, page, tokenFindings, structureFindings, uaePassFindings;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto(fx("seeded-step4.html"));
  tokenFindings = await runTokenFidelity(page);
  structureFindings = await runStructureChecks(page);
  uaePassFindings = await runUaePassCheck(page);
});
after(async () => await browser.close());

describe("token fidelity (T4)", () => {
  test("hard-coded inline colour on a DLS component is a serious finding", () => {
    const inline = tokenFindings.filter((f) => f.ruleId === "dls-token-inline-style");
    assert.equal(inline.length, 1);
    assert.equal(inline[0].severity, "serious");
    assert.match(inline[0].message, /color:#ff0000/);
  });

  test("a non-token computed background is flagged for review", () => {
    const hits = tokenFindings.filter(
      (f) => f.ruleId === "dls-token-color" && f.message.includes("rgb(1, 2, 3)"),
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].severity, "moderate");
    assert.match(hits[0].message, /review/);
  });

  test("a component styled with an exact token value does not flag", async () => {
    // The badge's colour IS --color-primary-50; resolve its computed value
    // and assert no dls-token-color finding names it.
    const badgeColor = await page.evaluate(
      () => getComputedStyle(document.querySelector(".aegov-badge")).color,
    );
    assert.ok(
      !tokenFindings.some(
        (f) => f.ruleId === "dls-token-color" && f.message.includes(`color ${badgeColor} `),
      ),
      `token-valued colour ${badgeColor} must not flag`,
    );
  });
});

describe("component structure (T5)", () => {
  test("check-item without a label flags; the valid one stays quiet", () => {
    const hits = structureFindings.filter((f) => f.ruleId === "dls-structure-check-item");
    assert.equal(hits.length, 1);
    assert.match(hits[0].message, /broken-check/);
    assert.equal(hits[0].confidence, "docs");
    assert.match(hits[0].helpUrl, /docs\/components\/checkbox/);
  });

  test("modal without role/name/wrapper flags all three problems; the valid one stays quiet", () => {
    const hits = structureFindings.filter((f) => f.ruleId === "dls-structure-modal");
    assert.equal(hits.length, 1);
    assert.match(hits[0].message, /broken-modal/);
    for (const problem of ["role", "accessible name", "aegov-modal-wrapper"]) {
      assert.ok(hits[0].message.includes(problem), problem);
    }
  });
});

describe("UAE Pass presence", () => {
  test("a login surface without UAE Pass is a serious finding", () => {
    assert.equal(uaePassFindings.length, 1);
    assert.equal(uaePassFindings[0].ruleId, "dls-uaepass-missing");
    assert.equal(uaePassFindings[0].severity, "serious");
    assert.match(uaePassFindings[0].message, /password input/);
  });

  test("the same login WITH a UAE Pass route stays quiet", async () => {
    const p = await browser.newPage();
    await p.goto(fx("uaepass-ok.html"));
    const findings = await runUaePassCheck(p);
    await p.close();
    assert.deepEqual(findings, []);
  });
});

describe("Arabic/RTL parity (flag, never assert)", () => {
  let parity;
  before(async () => {
    const en = await browser.newPage();
    await en.goto(fx("parity-en.html"));
    parity = await runParityCheck(browser, en, fx("parity-ar.html"));
    await en.close();
  });

  test("Arabic variant without dir=rtl is flagged", () => {
    const hits = parity.filter((f) => f.ruleId === "dls-parity-rtl");
    assert.equal(hits.length, 1);
  });

  test("structural drift (links, forms) and missing components are flagged", () => {
    assert.equal(parity.filter((f) => f.ruleId === "dls-parity-structure").length, 1);
    const comp = parity.filter((f) => f.ruleId === "dls-parity-components");
    assert.equal(comp.length, 1);
    assert.match(comp[0].message, /aegov-card/);
  });

  test("every parity finding is a human-review flag, never an assertion", () => {
    assert.ok(parity.length >= 3);
    for (const f of parity) {
      assert.match(f.message, /human review|native speaker/i, f.ruleId);
      assert.equal(f.confidence, "heuristic");
    }
  });
});
