/**
 * Class-attribute tokenizer soundness — regression cover for the adversarial
 * pass of 2026-07-29.
 *
 * engine.ts states the invariant that every attribute regex must be
 * case-insensitive (HTML attribute names are), and an earlier pass fixed
 * PATTERN= / ALT= / TYPE= accordingly — but missed `class` itself, the one
 * attribute that gates BOTH class identity (the "package-verified, certain"
 * tier) and block-contract application. Two live defects followed from the one
 * regex:
 *
 *   FALSE NEGATIVE — `<div CLASS="aegov-fake">` bypassed class validation
 *   entirely, so validate_snippet returned valid:true on invented classes and
 *   `<header CLASS="aegov-header">` never triggered the header contract.
 *
 *   FALSE POSITIVE — the `\b` boundary matched any attribute ENDING in "class"
 *   (`data-class`, `ng-class`, `:class`, `[class]`), whose values are arbitrary
 *   data or JS expressions, so valid markup was flagged with invented errors.
 *
 * Run: npm run build && node --test test/attribute-soundness.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadCatalog,
  buildClassIndex,
  classTokens,
  validateHtml,
  checkBlockSnippet,
} from "../dist/index.js";

const catalog = loadCatalog();
const index = buildClassIndex(catalog);
const contracts = catalog.blockContracts ?? [];
const errorsOf = (html) => validateHtml(html, index).findings.filter((f) => f.level === "error");

describe("class attribute names are case-insensitive", () => {
  for (const attr of ["class", "CLASS", "Class", "cLaSs"]) {
    test(`${attr}= with an invented aegov class is flagged`, () => {
      const errors = errorsOf(`<div ${attr}="aegov-fake-widget">x</div>`);
      assert.equal(errors.length, 1, `${attr}= must not bypass class validation`);
      assert.match(errors[0].message, /aegov-fake-widget/);
    });

    test(`${attr}= with a docs-only class is flagged`, () => {
      const errors = errorsOf(`<nav ${attr}="aegov-slider-next">x</nav>`);
      assert.equal(errors.length, 1);
      assert.match(errors[0].message, /does NOT ship/);
    });

    test(`${attr}= carrying a block root applies that block's contract`, () => {
      const blocks = checkBlockSnippet(`<header ${attr}="aegov-header"></header>`, contracts);
      assert.deepEqual(
        blocks.map((b) => b.blockId),
        ["header"],
        `${attr}= must still identify the block`,
      );
    });

    test(`${attr}= with a real class raises no error`, () => {
      assert.deepEqual(errorsOf(`<a ${attr}="aegov-btn">Go</a>`), []);
    });
  }
});

describe("attributes merely ENDING in 'class' are not class lists", () => {
  // Their values are arbitrary data or framework expressions — tokenising them
  // as CSS classes invents errors on valid markup.
  for (const attr of ["data-class", "ng-class", "x-bind:class", ":class", "[class]", "myclass"]) {
    test(`${attr}="…" is not tokenized as classes`, () => {
      assert.deepEqual(
        classTokens(`<div ${attr}="aegov-anything">x</div>`),
        [],
        `${attr} must not be read as a class attribute`,
      );
    });

    test(`${attr}="…" alongside a real class raises no error`, () => {
      assert.deepEqual(errorsOf(`<div ${attr}="aegov-anything" class="aegov-btn">x</div>`), []);
    });
  }

  test("className= (React) is not a class attribute either", () => {
    assert.deepEqual(classTokens('<div className="aegov-anything">x</div>'), []);
  });
});

describe("quoting variants still tokenize (no regression from the fix)", () => {
  const expected = ["aegov-btn"];
  test("double-quoted", () => assert.deepEqual(classTokens('<a class="aegov-btn">'), expected));
  test("single-quoted", () => assert.deepEqual(classTokens("<a class='aegov-btn'>"), expected));
  test("unquoted", () => assert.deepEqual(classTokens("<a class=aegov-btn>"), expected));
  test("spaced around =", () => assert.deepEqual(classTokens('<a class = "aegov-btn">'), expected));
  test("newline before the attribute", () =>
    assert.deepEqual(classTokens('<a\n  class="aegov-btn">'), expected));
  test("after a preceding quoted attribute", () =>
    assert.deepEqual(classTokens('<a href="#" class="aegov-btn">'), expected));
  test("multiple tokens, mixed whitespace", () =>
    assert.deepEqual(classTokens('<a class="aegov-btn\n  aegov-badge">'), [
      "aegov-btn",
      "aegov-badge",
    ]));
  test("at the very start of the input", () =>
    assert.deepEqual(classTokens('class="aegov-btn"'), expected));
});
