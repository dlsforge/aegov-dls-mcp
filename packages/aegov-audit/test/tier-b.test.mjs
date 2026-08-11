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
import {
  runHttpChecks,
  NOT_FOUND_PROBE_PATH,
  sitemapPageCandidates,
  SITEMAP_PAGE_PATHS,
  MAX_SITEMAP_PAGE_PROBES,
} from "../dist/engines/http.js";
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

  /** A human-facing site-map page: HTML, well past the link floor. */
  const SITEMAP_PAGE =
    "<!DOCTYPE html><html lang='ar' dir='rtl'><body><h1>خريطة الموقع</h1><ul>" +
    Array.from({ length: 14 }, (_, i) => `<li><a href="/section-${i}">قسم ${i}</a></li>`).join("") +
    "</ul></body></html>";

  function serve(handler) {
    return new Promise((res) => {
      const srv = createServer(handler);
      srv.listen(0, "127.0.0.1", () => res(srv));
    });
  }

  test("compliant origin (robots-declared sitemap + site-map page + designed 404) yields no findings", async () => {
    const srv = await serve((req, resp) => {
      if (req.url === "/robots.txt") {
        resp.writeHead(200, { "content-type": "text/plain" });
        resp.end(`User-agent: *\nSitemap: http://127.0.0.1:${srv.address().port}/custom-map.xml\n`);
      } else if (req.url === "/custom-map.xml") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset></urlset>');
      } else if (req.url === "/sitemap") {
        resp.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        resp.end(SITEMAP_PAGE);
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
      // A catch-all that answers 200 for every path must NOT read as a site-map
      // page: the body carries no links, so it fails the link floor.
      assert.deepEqual(ids, ["http-error-page", "http-sitemap", "http-sitemap-page"]);
      const err = findings.find((f) => f.ruleId === "http-error-page");
      assert.match(err.message, /soft 404|HTTP 200/i);
      assert.ok(err.targets[0].includes(NOT_FOUND_PROBE_PATH));
    } finally {
      srv.close();
    }
  });

  test("IIS default 404 (as served live by fnrc.gov.ae) flags even above the size threshold", async () => {
    // Real-world shape: styled-ish IIS default page, > 512 bytes, matched by
    // signature, not size. Added after a blind review caught the miss.
    const IIS_404 =
      '<!DOCTYPE html><html><head><title>404 - File or directory not found.</title>' +
      "<style>body{font-family:Arial}</style></head><body><div id=\"header\"><h1>Server Error</h1></div>" +
      '<div id="content"><div class="content-container"><fieldset>' +
      "<h2>404 - File or directory not found.</h2>" +
      "<h3>The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.</h3>" +
      `</fieldset></div></div>${"<!-- pad -->".repeat(30)}</body></html>`;
    assert.ok(IIS_404.length > 512, "fixture must exceed the bare-size threshold");
    const srv = await serve((req, resp) => {
      if (req.url === "/sitemap.xml") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset></urlset>');
      } else {
        resp.writeHead(404, { "content-type": "text/html" });
        resp.end(IIS_404);
      }
    });
    try {
      const findings = await runHttpChecks(`http://127.0.0.1:${srv.address().port}/`);
      // A valid Sitemap.xml settles 3.64 and nothing else: 1.5 still wants a
      // human-facing page, and this origin serves none.
      assert.deepEqual(
        findings.map((f) => f.ruleId).sort(),
        ["http-error-page", "http-sitemap-page"],
      );
      const err = findings.find((f) => f.ruleId === "http-error-page");
      assert.match(err.message, /bare server default/);
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
      // A valid Sitemap.xml settles 3.64 and nothing else: 1.5 still wants a
      // human-facing page, and this origin serves none.
      assert.deepEqual(
        findings.map((f) => f.ruleId).sort(),
        ["http-error-page", "http-sitemap-page"],
      );
      const err = findings.find((f) => f.ruleId === "http-error-page");
      assert.match(err.message, /bare server default/);
    } finally {
      srv.close();
    }
  });

  test("file:// targets skip the probes entirely", async () => {
    assert.deepEqual(await runHttpChecks("file:///C:/x.html"), []);
  });

  // ---- 1.5, the human-facing site-map page (separate from 3.64) ----

  test("site-map page at an unguessable path is found via the page's labelled link", async () => {
    // The fnrc.gov.ae shape: every well-known path 404s, the map lives at
    // /portal/sitemap, and only the footer link points there.
    const srv = await serve((req, resp) => {
      if (req.url === "/portal/sitemap") {
        resp.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        resp.end(SITEMAP_PAGE);
      } else if (req.url === "/sitemap.xml") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset></urlset>');
      } else {
        resp.writeHead(404, { "content-type": "text/html" });
        resp.end(DESIGNED_404);
      }
    });
    try {
      const base = `http://127.0.0.1:${srv.address().port}/`;
      const withLink = await runHttpChecks(base, [
        { href: "/portal/sitemap", text: "خريطة الموقع", title: "" },
      ]);
      assert.deepEqual(withLink.map((f) => f.ruleId), [], "labelled link should satisfy 1.5");

      // Same origin, no link supplied: the path is unguessable, so it flags.
      const blind = await runHttpChecks(base, []);
      assert.deepEqual(blind.map((f) => f.ruleId), ["http-sitemap-page"]);
    } finally {
      srv.close();
    }
  });

  test("an XML sitemap alone does not satisfy 1.5", async () => {
    const srv = await serve((req, resp) => {
      // /sitemap answers, but with XML — that is 3.64's artefact, not a page.
      if (req.url === "/sitemap.xml" || req.url === "/sitemap") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset><url><loc>/a</loc></url></urlset>');
      } else {
        resp.writeHead(404, { "content-type": "text/html" });
        resp.end(DESIGNED_404);
      }
    });
    try {
      const findings = await runHttpChecks(`http://127.0.0.1:${srv.address().port}/`);
      assert.deepEqual(findings.map((f) => f.ruleId), ["http-sitemap-page"]);
      assert.match(findings[0].message, /separate from item 3\.64/i);
    } finally {
      srv.close();
    }
  });

  test("a link that redirects into an error page does not qualify", async () => {
    // The fujmun.gov.ae shape: 200 status, but the server lands you on
    // /ErrorPage.html — a soft 404 that must not pass for a site map.
    const srv = await serve((req, resp) => {
      if (req.url.startsWith("/ErrorPage.html")) {
        resp.writeHead(200, { "content-type": "text/html" });
        resp.end(SITEMAP_PAGE); // link-rich, but reached at an error path
      } else if (req.url === "/sitemap.xml") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset></urlset>');
      } else {
        resp.writeHead(302, { location: "/ErrorPage.html?aspxerrorpath=" + req.url });
        resp.end();
      }
    });
    try {
      const findings = await runHttpChecks(`http://127.0.0.1:${srv.address().port}/`, [
        { href: "/site-structure", text: "Site map", title: "" },
      ]);
      // Redirect-everything is also a soft-404 origin, so http-error-page is
      // correct here too; what matters is that 1.5 was not satisfied.
      assert.deepEqual(
        findings.map((f) => f.ruleId).sort(),
        ["http-error-page", "http-sitemap-page"],
      );
    } finally {
      srv.close();
    }
  });

  test("a link-poor stub does not qualify as a site map", async () => {
    const srv = await serve((req, resp) => {
      if (req.url === "/sitemap") {
        resp.writeHead(200, { "content-type": "text/html" });
        resp.end("<html><body><h1>Site map</h1><a href='/'>Home</a></body></html>");
      } else if (req.url === "/sitemap.xml") {
        resp.writeHead(200, { "content-type": "application/xml" });
        resp.end('<?xml version="1.0"?><urlset></urlset>');
      } else {
        resp.writeHead(404, { "content-type": "text/html" });
        resp.end(DESIGNED_404);
      }
    });
    try {
      const findings = await runHttpChecks(`http://127.0.0.1:${srv.address().port}/`);
      assert.deepEqual(findings.map((f) => f.ruleId), ["http-sitemap-page"]);
    } finally {
      srv.close();
    }
  });

  test("network failure on every probe stays silent (no evidence is not absence)", async () => {
    // Nothing listening on this port: every GET rejects, so no rule may fire.
    const findings = await runHttpChecks("http://127.0.0.1:1/");
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });
});

describe("sitemapPageCandidates (pure — no network)", () => {
  const origin = "https://x.gov.ae";

  test("labelled links come first, then path-ish, then well-known paths", () => {
    const c = sitemapPageCandidates(origin, [
      { href: "/random", text: "Home", title: "" },
      { href: "/deep/nested/map-of-site", text: "خريطة الموقع", title: "" },
    ]);
    assert.equal(c[0].url, `${origin}/deep/nested/map-of-site`);
    assert.equal(c[0].labelled, true);
    assert.ok(c.some((x) => x.url === origin + SITEMAP_PAGE_PATHS[0]));
  });

  test("excludes .xml, cross-origin and unlabelled noise; caps the probe count", () => {
    const c = sitemapPageCandidates(origin, [
      { href: "/sitemap.xml", text: "خريطة الموقع", title: "" },
      { href: "https://other.gov.ae/sitemap", text: "Site map", title: "" },
      { href: "/contact", text: "Contact", title: "" },
    ]);
    assert.ok(!c.some((x) => /\.xml$/i.test(x.url)), "XML is 3.64's artefact");
    assert.ok(!c.some((x) => x.url.includes("other.gov.ae")), "cross-origin excluded");
    assert.ok(!c.some((x) => x.url.endsWith("/contact")), "unlabelled noise excluded");
    assert.ok(c.length <= MAX_SITEMAP_PAGE_PROBES);
  });

  test("a title attribute alone can label a link", () => {
    const c = sitemapPageCandidates(origin, [{ href: "/ia", text: "", title: "Site Map" }]);
    assert.equal(c[0].url, `${origin}/ia`);
    assert.equal(c[0].labelled, true);
  });

  test("malformed percent-encoding and junk hrefs do not throw", () => {
    // Arabic URLs are routinely percent-encoded; one bad escape must not take
    // the engine down mid-audit.
    assert.doesNotThrow(() =>
      sitemapPageCandidates(origin, [
        { href: "/bad%zz", text: "خريطة الموقع", title: "" },
        { href: "/%E0%A4%A", text: "Site map", title: "" },
        { href: "javascript:void(0)", text: "Site map", title: "" },
        { href: "", text: "Site map", title: "" },
        { href: "://nonsense", text: "", title: "" },
      ]),
    );
  });
});

describe("checklist growth and not-checked honesty for http-only items", () => {
  test("http-only items (1.5, 2.42, 3.38, 3.64) are not-checked without an http target", () => {
    const view = buildChecklistView([], { lighthouseRan: true, httpRan: false });
    for (const id of ["1.5", "2.42", "3.38", "3.64"]) {
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
