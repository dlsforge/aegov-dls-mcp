/**
 * Studio-enabler gate: (1) the library exports surface — importing the
 * package must expose the stable API WITHOUT executing the CLI; (2) the
 * --artifacts evidence bundle — screenshots at every breakpoint, extracted
 * copy, image inventory, self-describing manifest.
 *
 * Run: npm run build && node --test test/lib-artifacts.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;

describe("library exports surface", () => {
  let lib;
  before(async () => {
    // Resolve through the package name — this exercises the exports map the
    // way an external consumer (the Studio) does, not a relative dist path.
    lib = await import("@dlsforge/aegov-audit");
  });
  test("importing the package does not execute the CLI (process still alive, no side effects)", () => {
    assert.ok(lib, "import resolved");
  });
  for (const name of [
    // report layer
    "buildReport", "renderMarkdown", "buildChecklistView", "loadTdraCriteria",
    "machineCheckableIds", "fillWorkbook", "resolveTemplate", "countBySeverity",
    // engines the Studio handoff names + the newer surface
    "runParityCheck", "discoverAlternate", "settleNavigation",
    "runAxe", "runDlsRules", "runStyleChecks", "runKeyboardChecks",
    "runBreakpointCheck", "runCrawlChecks", "runStackChecks", "runHtmlValidation",
    // artifacts
    "writeArtifacts",
  ]) {
    test(`exports ${name}`, () => assert.equal(typeof lib[name], "function", name));
  }
  test("exports DLS_BREAKPOINTS and version constants", () => {
    assert.ok(Array.isArray(lib.DLS_BREAKPOINTS) && lib.DLS_BREAKPOINTS.length === 5);
    assert.equal(typeof lib.AXE_VERSION, "string");
    assert.equal(typeof lib.UA, "string");
  });
  test("deep dist imports still resolve (Studio 0.0.1 migration room)", async () => {
    const parity = await import("@dlsforge/aegov-audit/dist/engines/parity.js");
    assert.equal(typeof parity.runParityCheck, "function");
  });
});

describe("--artifacts evidence bundle", () => {
  let browser;
  before(async () => (browser = await chromium.launch()));
  after(async () => await browser.close());

  test("captures screenshots at default + all breakpoints, copy, images, manifest", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mizan-artifacts-"));
    const page = await browser.newPage();
    try {
      await page.goto(fx("seeded-styles.html"));
      const { writeArtifacts, DLS_BREAKPOINTS } = await import("@dlsforge/aegov-audit");
      const manifest = await writeArtifacts(page, dir, {
        target: "fixture",
        finalUrl: fx("seeded-styles.html"),
      });

      assert.equal(manifest.screenshots.length, 1 + DLS_BREAKPOINTS.length);
      for (const s of manifest.screenshots) {
        const file = join(dir, s.file);
        assert.ok(existsSync(file), s.file);
        const head = readFileSync(file).subarray(0, 8);
        assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "PNG magic");
      }

      const copy = JSON.parse(readFileSync(join(dir, "copy.json"), "utf8"));
      assert.equal(copy.lang, "en");
      assert.ok(copy.headings.some((h) => h.level === 1 && /heading rendered light/.test(h.text)));
      assert.match(copy.visibleText, /dominant sampled font family/);

      const images = JSON.parse(readFileSync(join(dir, "images.json"), "utf8"));
      assert.ok(Array.isArray(images));

      const written = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
      assert.equal(written.tool.name, "@dlsforge/aegov-audit");
      assert.match(written.note, /never a compliance verdict/);
      assert.ok(!/completed/i.test(JSON.stringify(written)), "no pass-adjacent wording");

      // viewport restored for whoever owns the page next
      assert.deepEqual(page.viewportSize(), { width: 1280, height: 720 });
    } finally {
      await page.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("image inventory carries alt/loading/decorative facts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mizan-artifacts-"));
    const page = await browser.newPage();
    try {
      await page.setContent(
        '<main><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Emblem" loading="lazy" width="40" height="40">' +
          '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" aria-hidden="true"></main>',
      );
      const { writeArtifacts } = await import("@dlsforge/aegov-audit");
      await writeArtifacts(page, dir, { target: "inline", finalUrl: "about:blank" });
      const images = JSON.parse(readFileSync(join(dir, "images.json"), "utf8"));
      assert.equal(images.length, 2);
      assert.equal(images[0].alt, "Emblem");
      assert.equal(images[0].loading, "lazy");
      assert.equal(images[1].alt, "");
      assert.equal(images[1].ariaHidden, true);
    } finally {
      await page.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
