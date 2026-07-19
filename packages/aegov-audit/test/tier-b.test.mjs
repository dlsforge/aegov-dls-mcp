/**
 * Stage 2B Tier B gate: document/asset, media and origin-HTTP rules answering
 * checklist items 2.35, 2.42, 3.8, 3.9, 3.23, 3.30, 3.31, 3.36, 3.37, 3.38,
 * 3.39, 3.41, 3.49, 3.50, 3.51, 3.52, 3.57, 3.59, 3.64.
 *
 * The seeded fixture must trip EVERY DOM rule; the clean fixture must trip
 * NONE (the false-positive gate). HTTP probes run against throwaway local
 * servers — a compliant origin and a broken one.
 *
 * Run: npm run build && node --test test/tier-b.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runAssetChecks } from "../dist/engines/assets.js";
import { runMediaChecks } from "../dist/engines/media.js";
import { runHttpChecks, NOT_FOUND_PROBE_PATH } from "../dist/engines/http.js";
import { buildChecklistView } from "../dist/report/tdra.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser;
before(async () => (browser = await chromium.launch()));
after(async () => await browser.close());

async function scanWith(fn, fixture) {
  const p = await browser.newPage();
  await p.goto(fx(fixture));
  const findings = await fn(p);
  await p.close();
  return findings;
}

describe("asset checks — seeded fixture trips every rule", () => {
  let ids;
  before(async () => {
    const findings = await scanWith(runAssetChecks, "seeded-assets.html");
    ids = findings.map((f) => f.ruleId);
  });
  for (const rule of [
    "dom-favicon",
    "dom-theme-color",
    "dom-og-tags",
    "dom-semantic-tags",
    "dom-noopener",
    "dom-blocking-script-head",
    "dom-cookie-banner",
    "dom-skip-link",
    "dom-icon-aria-hidden",
    "dom-icon-no-text",
    "dom-selfhosted-fonts",
  ]) {
    test(`${rule} fires on the seeded fixture`, () => assert.ok(ids.includes(rule), ids.join(",")));
  }
});

describe("media checks — seeded fixture trips every rule", () => {
  let ids;
  before(async () => {
    const findings = await scanWith(runMediaChecks, "seeded-assets.html");
    ids = findings.map((f) => f.ruleId);
  });
  for (const rule of [
    "dom-no-srcset",
    "dom-hero-no-picture",
    "dom-no-lazy-loading",
    "dom-no-webp",
    "dom-selfhosted-video",
  ]) {
    test(`${rule} fires on the seeded fixture`, () => assert.ok(ids.includes(rule), ids.join(",")));
  }
});

describe("false-positive gate — the clean fixture trips nothing", () => {
  test("asset checks stay silent", async () => {
    const findings = await scanWith(runAssetChecks, "clean-assets.html");
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });
  test("media checks stay silent", async () => {
    const findings = await scanWith(runMediaChecks, "clean-assets.html");
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });
});

describe("origin HTTP probes (local throwaway servers)", () => {
  const DESIGNED_404 =
    "<!DOCTYPE html><html lang='en'><body><nav><a href='/'>Home</a></nav>" +
    "<h1>Page not found</h1><p>الصفحة غير موجودة — the page you requested does not exist. " +
    "Try the services directory or return to the home page.</p>" +
    `<p>${"placeholder ".repeat(40)}</p></body></html>`;

  function serve(handler) {
    return new Promise((res) => {
      const srv = createServer(handler);
      srv.listen(0, "127.0.0.1", () => res(srv));
    });
  }

  test("compliant origin (robots-declared sitemap + designed 404) yields no findings", async () => {
    const srv = await serve((req, resp) => {
      if (req.url === "/robots.txt") {
        resp.writeHead(200, { "content-type": "text/plain" });
        resp.end(`User-agent: *\nSitemap: http://127.0.0.1:${srv.address().port}/custom-map.xml\n`);
      } else if (req.url === "/custom-map.xml") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset></urlset>');
      } else {
        resp.writeHead(404, { "content-type": "text/html" });
        resp.end(DESIGNED_404);
      }
    });
    try {
      const findings = await runHttpChecks(`http://127.0.0.1:${srv.address().port}/`);
      assert.deepEqual(findings.map((f) => f.ruleId), []);
    } finally {
      srv.close();
    }
  });

  test("broken origin: missing sitemap flags, soft-404 flags", async () => {
    const srv = await serve((req, resp) => {
      // everything answers 200 HTML — including /sitemap.xml and the probe
      resp.writeHead(200, { "content-type": "text/html" });
      resp.end("<html><body>welcome</body></html>");
    });
    try {
      const findings = await runHttpChecks(`http://127.0.0.1:${srv.address().port}/`);
      const ids = findings.map((f) => f.ruleId).sort();
      assert.deepEqual(ids, ["http-error-page", "http-sitemap"]);
      const err = findings.find((f) => f.ruleId === "http-error-page");
      assert.match(err.message, /soft 404|HTTP 200/i);
      assert.ok(err.targets[0].includes(NOT_FOUND_PROBE_PATH));
    } finally {
      srv.close();
    }
  });

  test("bare default 404 page flags as not designed", async () => {
    const srv = await serve((req, resp) => {
      if (req.url === "/sitemap.xml") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset></urlset>');
      } else {
        resp.writeHead(404, { "content-type": "text/html" });
        resp.end("<html><head><title>404 Not Found</title></head><body>404</body></html>");
      }
    });
    try {
      const findings = await runHttpChecks(`http://127.0.0.1:${srv.address().port}/`);
      assert.deepEqual(findings.map((f) => f.ruleId), ["http-error-page"]);
      assert.match(findings[0].message, /bare server default/);
    } finally {
      srv.close();
    }
  });

  test("file:// targets skip the probes entirely", async () => {
    assert.deepEqual(await runHttpChecks("file:///C:/x.html"), []);
  });
});

describe("checklist growth and not-checked honesty for http-only items", () => {
  test("http-only items (2.42, 3.38, 3.64) are not-checked without an http target", () => {
    const view = buildChecklistView([], { lighthouseRan: true, httpRan: false });
    for (const id of ["2.42", "3.38", "3.64"]) {
      assert.equal(view.machineCheckedItems.find((i) => i.id === id).status, "not-checked", id);
    }
    // DOM-rule items ran regardless of transport
    assert.equal(
      view.machineCheckedItems.find((i) => i.id === "2.35").status,
      "no-automated-findings",
    );
  });

  test("a Tier B finding lands on its item: skip link → 2.35 (a SECTION 2 item)", async () => {
    const findings = await scanWith(runAssetChecks, "seeded-assets.html");
    const view = buildChecklistView(findings, { lighthouseRan: false, httpRan: false });
    const item = view.machineCheckedItems.find((i) => i.id === "2.35");
    assert.equal(item.status, "findings");
    assert.match(item.question, /Skip to content/i);
  });
});
