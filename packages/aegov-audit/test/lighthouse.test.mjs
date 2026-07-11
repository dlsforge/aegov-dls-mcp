/**
 * Step-3 gate (STAGE2-HANDOFF §6): Lighthouse produces the four TDRA
 * categories under documented run conditions. Hermetic — the fixture is
 * served from a local http server (Lighthouse cannot score file:// URLs),
 * so no external site is involved.
 *
 * Run: npm run build && node --test test/lighthouse.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { runLighthouse } from "../dist/engines/lighthouse.js";

const fixture = readFileSync("test/fixtures/seeded-a11y.html", "utf8");
let server, result;

before(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fixture);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  result = await runLighthouse(url, "mobile");
});
after(() => server.close());

describe("lighthouse over a locally served page", () => {
  test("all four TDRA categories come back as 0-100 scores", { timeout: 120_000 }, () => {
    for (const key of ["performance", "accessibility", "bestPractices", "seo"]) {
      const v = result.scores[key];
      assert.ok(
        typeof v === "number" && v >= 0 && v <= 100,
        `${key} must be a 0-100 score, got ${v}`,
      );
    }
  });

  test("the seeded a11y defects depress the accessibility score", () => {
    assert.ok(
      result.scores.accessibility < 100,
      `fixture has known defects; accessibility=${result.scores.accessibility}`,
    );
  });

  test("run conditions are recorded and disclaim TDRA comparability", () => {
    const rc = result.runConditions;
    assert.equal(rc.formFactor, "mobile");
    assert.ok(rc.lighthouseVersion.length > 0);
    assert.match(rc.throttling, /simulate/);
    assert.match(rc.screenEmulation, /mobile/);
    assert.match(rc.note, /NOT to TDRA/);
  });
});
