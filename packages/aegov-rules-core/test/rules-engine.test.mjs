/**
 * Unit tests for the extracted DLS rule engine (STAGE2-HANDOFF §6 step 0) —
 * the checks as PURE FUNCTIONS, no MCP layer. End-to-end coverage of the same
 * rules through validate_snippet lives in the aegov-mcp package's suites
 * (edge-cases, validate-soundness2); this suite pins the extraction seam.
 *
 * Run: npm run build && node --test test/rules-engine.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadCatalog,
  classTokens,
  buildClassIndex,
  checkClassIdentity,
  checkImgAlt,
  checkButtonType,
  checkFullEidValue,
  checkEmiratesIdInputs,
  checkMdyDates,
  checkArabicRtl,
  validateHtml,
  EID_PATTERN,
} from "../dist/index.js";

const catalog = loadCatalog();
const index = buildClassIndex(catalog);

describe("classTokens (F4/N2 lineage: quoted, single-quoted, unquoted, case)", () => {
  test("extracts from all three HTML5 attribute forms", () => {
    const html = `<div class="a b"><span class='c'><i class=d></i></span></div>`;
    assert.deepEqual(classTokens(html).sort(), ["a", "b", "c", "d"]);
  });
});

describe("buildClassIndex", () => {
  test("package truth and packageRef come from the pinned catalogue", () => {
    assert.ok(index.packageClasses.has("aegov-btn"));
    assert.equal(
      index.packageRef,
      `${catalog.meta.generatedFrom.package}@${catalog.meta.generatedFrom.version}`,
    );
    assert.ok(Object.keys(index.docsOnly).length > 0, "knownDocsOnlyClasses must be present");
  });
});

describe("checkClassIdentity", () => {
  test("a shipped class verifies clean, package tier", () => {
    const { findings, classes } = checkClassIdentity('<button class="aegov-btn">x</button>', index);
    assert.deepEqual(findings, []);
    assert.deepEqual(classes.packageVerified, ["aegov-btn"]);
  });

  test("an unknown aegov-* class errors with a did-you-mean", () => {
    const { findings } = checkClassIdentity('<button class="aegov-btnn">x</button>', index);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "error");
    assert.equal(findings[0].confidence, "package");
    assert.match(findings[0].message, /Did you mean: .*aegov-btn/);
  });

  test("a docs-only drift class errors, naming the pinned package", () => {
    const driftClass = Object.keys(index.docsOnly)[0];
    const { findings } = checkClassIdentity(`<nav class="${driftClass}">x</nav>`, index);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "error");
    assert.ok(findings[0].message.includes(index.packageRef));
  });

  test("an unseen non-aegov class is info, docs tier (cannot verify)", () => {
    const { findings, classes } = checkClassIdentity('<div class="zz-nonexistent">x</div>', index);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, "info");
    assert.equal(findings[0].confidence, "docs");
    assert.deepEqual(classes.unverified, ["zz-nonexistent"]);
  });
});

describe("heuristic checks as pure functions", () => {
  test("img without alt errors; with alt (any case) passes", () => {
    assert.equal(checkImgAlt('<img src="x.png">').length, 1);
    assert.equal(checkImgAlt('<img src="x.png" alt="x">').length, 0);
    assert.equal(checkImgAlt('<img src="x.png" ALT="x">').length, 0);
  });

  test("button without explicit type warns; with type passes", () => {
    const w = checkButtonType("<button>x</button>");
    assert.equal(w.length, 1);
    assert.equal(w[0].level, "warning");
    assert.equal(checkButtonType('<button type="button">x</button>').length, 0);
  });

  test("a displayed full-format Emirates ID errors; masked passes; the pattern attribute is exempt", () => {
    assert.equal(checkFullEidValue("<p>784-1984-1234567-1</p>").length, 1);
    assert.equal(checkFullEidValue("<p>784-1984-XXXXXXX-X</p>").length, 0);
    assert.equal(checkFullEidValue(`<input pattern="${EID_PATTERN}">`).length, 0);
  });

  test("an Emirates ID input must carry the exact pattern", () => {
    assert.equal(checkEmiratesIdInputs('<input name="emirates-id">').length, 1);
    assert.equal(
      checkEmiratesIdInputs(`<input name="emirates-id" pattern="${EID_PATTERN}">`).length,
      0,
    );
    const wrong = checkEmiratesIdInputs('<input name="emirates-id" pattern="\\d+">');
    assert.equal(wrong.length, 1);
    assert.match(wrong[0].message, /differs from the required/);
  });

  test("an EID field identified only by its <label> is still caught; a search box is not", () => {
    const labelled =
      '<label for="f1">Emirates ID</label><input id="f1" name="field1">';
    assert.equal(checkEmiratesIdInputs(labelled).length, 1);
    const search =
      '<label for="q">Search Emirates ID services</label><input id="q" type="search" name="q">';
    assert.equal(checkEmiratesIdInputs(search).length, 0);
  });

  test("unambiguous MDY dates error with the DMY rewrite; ambiguous and DMY pass", () => {
    const f = checkMdyDates("<p>Published 12/31/2026</p>");
    assert.equal(f.length, 1);
    assert.match(f[0].message, /write it as 31\/12\/2026/);
    assert.equal(checkMdyDates("<p>03/07/2026</p>").length, 0);
    assert.equal(checkMdyDates("<p>31/12/2026</p>").length, 0);
  });

  test("Arabic without an RTL direction warns; with dir=rtl passes", () => {
    assert.equal(checkArabicRtl("<p>مرحبا</p>").length, 1);
    assert.equal(checkArabicRtl('<p dir="rtl">مرحبا</p>').length, 0);
    assert.equal(checkArabicRtl("<p>hello</p>").length, 0);
  });
});

describe("validateHtml (the orchestrator both tools call)", () => {
  test("aggregates every check in the established order", () => {
    const html =
      '<div class="aegov-nope"><img src="x.png"><button>x</button>' +
      '<input name="emirates-id"><p>12/31/2026</p><p>مرحبا</p></div>';
    const { findings } = validateHtml(html, index);
    const levels = findings.map((f) => f.level);
    assert.equal(levels.filter((l) => l === "error").length, 4, "class, alt, EID, MDY");
    assert.equal(levels.filter((l) => l === "warning").length, 2, "button type, Arabic RTL");
  });

  test("a fully valid, RTL-correct DLS snippet produces zero findings", () => {
    const { findings, classes } = validateHtml(
      '<button class="aegov-btn" type="button" dir="rtl">تقديم</button>',
      index,
    );
    assert.deepEqual(findings, []);
    assert.deepEqual(classes.packageVerified, ["aegov-btn"]);
  });
});
