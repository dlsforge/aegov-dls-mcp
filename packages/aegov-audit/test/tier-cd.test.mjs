/**
 * Stage 2B Tier C+D gate: computed-style rules against rules-core tokens
 * (items 2.2, 2.3, 2.6, 2.7, 2.8, 2.9, 2.10, 2.12, 2.23), interaction rules
 * (2.38, 3.13, 3.14) and the bounded crawl (3.25, 3.29, 3.35 upgrade).
 *
 * Same contract as tier-b: the seeded fixtures must trip EVERY rule; the
 * clean fixtures must trip NONE (the false-positive gate). Crawl checks run
 * against throwaway local servers, including a robots.txt Disallow that the
 * crawler must honour.
 *
 * Run: npm run build && node --test test/tier-cd.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { loadCatalog } from "@dlsforge/aegov-rules-core";
import { runStyleChecks } from "../dist/engines/styles.js";
import { runZoomCheck, runKeyboardChecks } from "../dist/engines/interaction.js";
import { runCrawlChecks, parseRobots } from "../dist/engines/crawl.js";
import { buildChecklistView } from "../dist/report/tdra.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser;
before(async () => (browser = await chromium.launch()));
after(async () => await browser.close());

async function withPage(fixture, fn) {
  const p = await browser.newPage();
  try {
    await p.goto(fx(fixture));
    return await fn(p);
  } finally {
    await p.close();
  }
}

describe("style checks — seeded fixture trips every rule", () => {
  let ids;
  before(async () => {
    const findings = await withPage("seeded-styles.html", (p) => runStyleChecks(p));
    ids = findings.map((f) => f.ruleId);
  });
  for (const rule of [
    "style-font-family",
    "style-heading-typography",
    "style-background-neutral",
    "style-text-primary",
    "style-action-gold",
    "style-section-contrast",
    "style-action-contrast",
    "style-icon-size",
  ]) {
    test(`${rule} fires on the seeded fixture`, () => assert.ok(ids.includes(rule), ids.join(",")));
  }
  test("ministry-palette does NOT fire without --entity-type ministry", () =>
    assert.ok(!ids.includes("ministry-palette")));
});

describe("ministry palette (2.12) — token-scale classification", () => {
  const supportToken = loadCatalog().tokens.find((t) =>
    /^--color-(seablue|camel|techblue|fuchsia|desert|slate)-600$/.test(t.name),
  );
  test("a support-palette token on an action element fires with --entity-type ministry", async () => {
    assert.ok(supportToken, "catalog must carry a support palette");
    const p = await browser.newPage();
    try {
      await p.setContent(
        `<main><p>Ministry palette probe page with sufficient body text to render.</p>
         <button type="button" style="background:${supportToken.value};color:#fff">Act</button></main>`,
      );
      const flagged = await runStyleChecks(p, { entityType: "ministry" });
      const hit = flagged.filter((f) => f.ruleId === "ministry-palette");
      assert.equal(hit.length, 1, flagged.map((f) => f.ruleId).join(","));
      // The reported name may be a value-alias of the injected token (e.g.
      // camel-600 IS primary-support-600) — assert scale class, not the name.
      assert.match(hit[0].message, /uses DLS token --color-[a-z-]+-600 \(the "[a-z-]+" support palette\)/);
      const unflagged = await runStyleChecks(p, { entityType: null });
      assert.ok(!unflagged.some((f) => f.ruleId === "ministry-palette"));
    } finally {
      await p.close();
    }
  });
  test("aegold on actions never trips the ministry rule", async () => {
    const gold = loadCatalog().tokens.find((t) => t.name === "--color-aegold-600");
    const p = await browser.newPage();
    try {
      await p.setContent(
        `<main><button type="button" style="background:${gold.value};color:#fff">Act</button></main>`,
      );
      const findings = await runStyleChecks(p, { entityType: "ministry" });
      assert.ok(!findings.some((f) => f.ruleId === "ministry-palette"));
    } finally {
      await p.close();
    }
  });
});

describe("interaction checks — seeded fixture trips every rule", () => {
  test("kbd-focus-indicator and kbd-region-unreachable fire", async () => {
    const { findings, ran } = await withPage("seeded-interaction.html", (p) =>
      runKeyboardChecks(p),
    );
    assert.equal(ran, true);
    const ids = findings.map((f) => f.ruleId);
    assert.ok(ids.includes("kbd-focus-indicator"), ids.join(","));
    assert.ok(ids.includes("kbd-region-unreachable"), ids.join(","));
    const unreachable = findings.find((f) => f.ruleId === "kbd-region-unreachable");
    assert.match(unreachable.message, /footer/);
  });
  test("ix-zoom-overflow fires on the fixed-width layout", async () => {
    const findings = await withPage("seeded-interaction.html", (p) => runZoomCheck(p));
    assert.deepEqual(findings.map((f) => f.ruleId), ["ix-zoom-overflow"]);
    assert.match(findings[0].message, /175% zoom/);
  });
});

describe("false-positive gate — the clean fixture trips nothing", () => {
  test("style checks stay silent", async () => {
    const findings = await withPage("clean-styles.html", (p) => runStyleChecks(p));
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });
  test("style checks stay silent even as a ministry", async () => {
    const findings = await withPage("clean-styles.html", (p) =>
      runStyleChecks(p, { entityType: "ministry" }),
    );
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });
  test("keyboard checks stay silent (UA focus ring counts as indication)", async () => {
    const { findings, ran } = await withPage("clean-styles.html", (p) => runKeyboardChecks(p));
    assert.equal(ran, true);
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });
  test("zoom check stays silent on the fluid layout", async () => {
    const findings = await withPage("clean-styles.html", (p) => runZoomCheck(p));
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });
});

describe("robots.txt parsing", () => {
  test("our UA group wins over *, wildcards work", () => {
    const body = [
      "User-agent: *",
      "Disallow: /everything",
      "",
      "User-agent: aegov-audit",
      "Disallow: /private/*",
    ].join("\n");
    assert.deepEqual(parseRobots(body, "aegov-audit/0.1.0 (Mizan)"), ["/private/*"]);
  });
  test("falls back to the * group", () => {
    const body = "User-agent: googlebot\nDisallow: /a\n\nUser-agent: *\nDisallow: /b";
    assert.deepEqual(parseRobots(body, "aegov-audit"), ["/b"]);
  });
});

describe("bounded crawl (local throwaway servers)", () => {
  const page = (title, body, { desc = "", alternate = false } = {}) =>
    `<!DOCTYPE html><html lang="en"><head><title>${title}</title>` +
    (desc ? `<meta name="description" content="${desc}">` : "") +
    (alternate ? '<link rel="alternate" hreflang="ar" href="/ar">' : "") +
    `</head><body>${body}</body></html>`;

  function serve(routes) {
    return new Promise((res) => {
      const srv = createServer((req, resp) => {
        const route = routes[req.url.split("?")[0]];
        if (!route) {
          resp.writeHead(404, { "content-type": "text/html" });
          resp.end("<html><body>gone</body></html>");
          return;
        }
        resp.writeHead(200, { "content-type": route.type ?? "text/html" });
        resp.end(route.body);
      });
      srv.listen(0, "127.0.0.1", () => res(srv));
    });
  }

  test("duplicates, missing alternates, missing rating block — and robots is honoured", async () => {
    const nav =
      '<nav><a href="/a">A</a> <a href="/b">B</a> <a href="/blocked">Blocked</a> ' +
      '<a href="/services/apply">Apply</a></nav>';
    const srv = await serve({
      "/": { body: page("Home", nav, { desc: "home page", alternate: true }) },
      "/a": { body: page("Duplicate Title", "<p>page a</p>", { desc: "same description" }) },
      "/b": { body: page("Duplicate Title", "<p>page b</p>", { desc: "same description" }) },
      "/blocked": { body: page("Duplicate Title", "<p>robots must keep this out</p>") },
      "/services/apply": {
        body: page("Apply for a service certificate", "<h1>Service application</h1>", {
          desc: "unique apply description",
          alternate: true,
        }),
      },
      "/robots.txt": { body: "User-agent: *\nDisallow: /blocked", type: "text/plain" },
    });
    const base = `http://127.0.0.1:${srv.address().port}/`;
    const p = await browser.newPage();
    try {
      await p.goto(base);
      const { findings, pagesCrawled } = await runCrawlChecks(browser, p, base);
      assert.equal(pagesCrawled, 3, "a, b, apply — blocked is robots-disallowed");
      const byRule = Object.fromEntries(findings.map((f) => [f.ruleId, f]));
      assert.ok(byRule["crawl-title-duplicate"], findings.map((f) => f.ruleId).join(","));
      assert.ok(!byRule["crawl-title-duplicate"].targets.some((t) => t.includes("/blocked")));
      assert.ok(byRule["crawl-description-duplicate"]);
      assert.ok(byRule["crawl-alternate-missing"]);
      assert.ok(byRule["crawl-alternate-missing"].targets.some((t) => t.endsWith("/a")));
      assert.ok(!byRule["crawl-alternate-missing"].targets.some((t) => t.includes("/services/apply")));
      assert.ok(byRule["crawl-page-rating"]);
      assert.match(byRule["crawl-page-rating"].message, /heuristic/i);
      assert.ok(byRule["crawl-page-rating"].targets.some((t) => t.includes("/services/apply")));
    } finally {
      await p.close();
      srv.close();
    }
  });

  test("a conforming site yields no crawl findings", async () => {
    const nav = '<nav><a href="/x">X</a> <a href="/services/pay">Pay</a></nav>';
    const srv = await serve({
      "/": { body: page("Home", nav, { desc: "home page", alternate: true }) },
      "/x": { body: page("About us", "<p>about</p>", { desc: "about description", alternate: true }) },
      "/services/pay": {
        body: page(
          "Pay for a service",
          '<h1>Payment service</h1><div class="page-rating">Was this page helpful?</div>',
          { desc: "pay description", alternate: true },
        ),
      },
    });
    const base = `http://127.0.0.1:${srv.address().port}/`;
    const p = await browser.newPage();
    try {
      await p.goto(base);
      const { findings, pagesCrawled } = await runCrawlChecks(browser, p, base);
      assert.equal(pagesCrawled, 2);
      assert.deepEqual(findings.map((f) => f.ruleId), []);
    } finally {
      await p.close();
      srv.close();
    }
  });

  test("file:// targets skip the crawl entirely", async () => {
    const p = await browser.newPage();
    try {
      await p.goto(fx("clean-styles.html"));
      const { findings, pagesCrawled } = await runCrawlChecks(browser, p, fx("clean-styles.html"));
      assert.equal(pagesCrawled, 0);
      assert.deepEqual(findings, []);
    } finally {
      await p.close();
    }
  });
});

describe("checklist gating for the new evidence engines", () => {
  test("crawl-only items (3.25, 3.29) and 2.12 are not-checked by default; 3.35 stays checked", () => {
    const view = buildChecklistView([], { lighthouseRan: true, httpRan: true });
    const status = (id) => view.machineCheckedItems.find((i) => i.id === id).status;
    assert.equal(status("3.25"), "not-checked");
    assert.equal(status("3.29"), "not-checked");
    assert.equal(status("2.12"), "not-checked");
    assert.equal(status("3.35"), "no-automated-findings"); // meta-alternate also evidences it
    assert.equal(status("2.38"), "no-automated-findings"); // zoom always runs
    assert.equal(status("3.13"), "no-automated-findings"); // kbdRan defaults true
  });
  test("an aborted keyboard walk flips 3.13/3.14 to not-checked", () => {
    const view = buildChecklistView([], { lighthouseRan: true, httpRan: true, kbdRan: false });
    const status = (id) => view.machineCheckedItems.find((i) => i.id === id).status;
    assert.equal(status("3.13"), "not-checked");
    assert.equal(status("3.14"), "not-checked");
    assert.equal(status("2.38"), "no-automated-findings");
  });
  test("crawlRan/ministryChecked open their items", () => {
    const view = buildChecklistView([], {
      lighthouseRan: true,
      httpRan: true,
      crawlRan: true,
      ministryChecked: true,
    });
    const status = (id) => view.machineCheckedItems.find((i) => i.id === id).status;
    assert.equal(status("3.29"), "no-automated-findings");
    assert.equal(status("3.25"), "no-automated-findings");
    assert.equal(status("2.12"), "no-automated-findings");
  });
  test("coverage grew to at least 50 machine-checked items (the Stage 2B exit bar)", () => {
    const view = buildChecklistView([], {});
    assert.ok(
      view.machineCheckedItems.length >= 50,
      `only ${view.machineCheckedItems.length} machine-checked items`,
    );
  });
  test("a Tier C finding lands on its item: style-action-gold → 2.8", async () => {
    const findings = await withPage("seeded-styles.html", (p) => runStyleChecks(p));
    const view = buildChecklistView(findings, {});
    const item = view.machineCheckedItems.find((i) => i.id === "2.8");
    assert.equal(item.status, "findings");
    assert.match(item.question, /AEGOLD-600/);
  });
});
