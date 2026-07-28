/**
 * validate_snippet vs the docs-sourced block contracts — end to end through a
 * real MCP client, so the tool's actual response shape is what gets pinned.
 *
 * The contracts live in @dlsforge/aegov-rules-core and are shared with Mizan;
 * this suite covers the SNIPPET path, where there is no DOM. What matters most
 * here is the boundary: a fragment cannot answer every requirement, and the
 * response must say which ones it did not judge rather than let silence read as
 * a pass.
 *
 * Run: npm run build && node --test test/block-snippets.test.mjs
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { connectServer } from "./helpers/mcp.mjs";

let srv;
before(async () => {
  srv = await connectServer();
});
after(async () => {
  await srv.close();
});

const validate = async (html) => (await srv.call("validate_snippet", { html })).body;
const blockFindings = (b) => b.findings.filter((f) => /block:/.test(f.message));

describe("a snippet that is not a documented block", () => {
  test("is not judged against block contracts at all", async () => {
    const body = await validate(`<button class="aegov-btn" type="submit">Send</button>`);
    assert.equal(body.blocks, undefined, "no block key when no block is present");
    assert.deepEqual(blockFindings(body), []);
    assert.equal(body.valid, true);
  });
});

describe("a header snippet", () => {
  test("missing the mobile affordance is flagged, with the docs URL and a fix", async () => {
    const body = await validate(
      `<header class="aegov-header"><nav><ul class="nav-menu"><li><a href="/">Home</a></li></ul></nav></header>`,
    );
    const found = blockFindings(body);
    assert.equal(found.length, 1);
    assert.equal(found[0].level, "warning");
    assert.equal(found[0].confidence, "docs");
    assert.match(found[0].message, /mobile menu affordance/);
    assert.match(found[0].message, /designsystem\.gov\.ae\/docs\/blocks\/header/);
  });

  test("with a documented toggle produces no block finding", async () => {
    const body = await validate(
      `<header class="aegov-header"><button type="button" aria-controls="m" aria-expanded="false">Menu</button></header>`,
    );
    assert.deepEqual(blockFindings(body), []);
  });

  test("names what a fragment could not judge", async () => {
    const body = await validate(`<header class="aegov-header" aria-controls="m"></header>`);
    assert.equal(body.blocks.length, 1);
    assert.equal(body.blocks[0].block, "header");
    assert.deepEqual(
      body.blocks[0].notCheckableInASnippet.map((n) => n.requirementId),
      ["header.nav-max-items"],
      "the navigation limit needs a rendered tree — say so, do not pass it",
    );
    assert.match(body.note, /notCheckableInASnippet/);
    assert.match(body.summary, /Header block/);
  });
});

describe("a footer snippet", () => {
  test("without the mobile accordion is flagged", async () => {
    const body = await validate(`<footer class="aegov-footer"><a href="/a">Services</a></footer>`);
    const found = blockFindings(body);
    assert.equal(found.length, 1);
    assert.match(found[0].message, /accordion/);
    assert.match(found[0].message, /aegov-mobile-accordion/, "the fix should name the class to add");
  });

  test("with it is clean, and the year is reported as unjudged", async () => {
    const body = await validate(
      `<footer class="aegov-footer"><nav class="aegov-accordion aegov-mobile-accordion" data-accordion="collapse"></nav></footer>`,
    );
    assert.deepEqual(blockFindings(body), []);
    assert.deepEqual(
      body.blocks[0].notCheckableInASnippet.map((n) => n.requirementId),
      ["footer.copyright-year"],
    );
  });
});

describe("block findings coexist with the ordinary rules", () => {
  test("a header with an alt-less image reports both", async () => {
    const body = await validate(
      `<header class="aegov-header"><img src="logo.svg"><nav></nav></header>`,
    );
    assert.ok(
      body.findings.some((f) => /alt/i.test(f.message)),
      "the img-alt rule must still fire",
    );
    assert.equal(blockFindings(body).length, 1, "and the block contract alongside it");
  });

  test("an unknown aegov-* class still errors, and blocks do not mask it", async () => {
    const body = await validate(`<header class="aegov-header aegov-not-real"></header>`);
    assert.equal(body.valid, false);
    assert.ok(body.findings.some((f) => f.level === "error" && /aegov-not-real/.test(f.message)));
  });
});
