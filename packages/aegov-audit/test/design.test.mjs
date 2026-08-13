/**
 * Design-conformance gate: the checklist items the rendered page settles on
 * its own (1.15, 2.28, 2.31, 2.33, 3.5, 3.44, 3.45).
 *
 * Same contract as the other tier gates — the seeded fixture must trip EVERY
 * rule and the clean fixture must trip NONE (the false-positive gate) — plus
 * the not-applicable contract: a page with no form, no prose links or no
 * readable CSS must report those rules as unanswerable rather than clean.
 *
 * Run: npm run build && node --test test/design.test.mjs
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runDesignChecks } from "../dist/engines/design.js";
import { runResponsiveDesignChecks } from "../dist/engines/interaction.js";
import { buildChecklistView } from "../dist/report/tdra.js";

const fx = (name) => pathToFileURL(resolve(`test/fixtures/${name}`)).href;
let browser;
before(async () => (browser = await chromium.launch()));
after(async () => await browser.close());

async function onFixture(name) {
  const p = await browser.newPage();
  try {
    await p.route(/^https?:/, (route) => route.abort()); // hermetic
    await p.goto(fx(name));
    return await runDesignChecks(p);
  } finally {
    await p.close();
  }
}

async function onContent(html) {
  const p = await browser.newPage();
  try {
    await p.setContent(html);
    return await runDesignChecks(p);
  } finally {
    await p.close();
  }
}

describe("seeded fixture trips every design rule", () => {
  let ids, findings;
  before(async () => {
    ({ findings } = await onFixture("seeded-design.html"));
    ids = findings.map((f) => f.ruleId);
  });
  for (const rule of [
    "design-action-affordance",
    "design-site-boxed",
    "design-form-components",
    "design-graceful-degradation",
    "design-mobile-first",
    "design-british-english",
  ]) {
    test(`${rule} fires`, () => assert.ok(ids.includes(rule), ids.join(",")));
  }

  test("messages carry the concrete evidence, not a bare verdict", () => {
    const by = Object.fromEntries(findings.map((f) => [f.ruleId, f]));
    assert.match(by["design-mobile-first"].message, /max-width/);
    assert.match(by["design-site-boxed"].message, /wrapper/);
    assert.match(by["design-british-english"].message, /colou?r|centre|organis/i);
  });
});

describe("clean fixture trips none (false-positive gate)", () => {
  test("no findings at all", async () => {
    const { findings } = await onFixture("clean-design.html");
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  });

  test("and nothing is silently skipped — every rule had its anchor", async () => {
    const { notApplicableRules } = await onFixture("clean-design.html");
    assert.deepEqual(notApplicableRules, []);
  });
});

describe("not-applicable, never a false pass", () => {
  test("a page with no form cannot evidence 2.33", async () => {
    const { notApplicableRules } = await onContent(
      "<html lang='en'><body><p>No form here at all.</p></body></html>",
    );
    assert.ok(notApplicableRules.includes("design-form-components"), notApplicableRules.join(","));
  });

  test("a page with no prose links cannot evidence 2.31", async () => {
    const { notApplicableRules } = await onContent(
      "<html lang='en'><body><button>Only a button</button></body></html>",
    );
    assert.ok(notApplicableRules.includes("design-action-affordance"));
  });

  test("a page with no readable stylesheet cannot evidence 2.28", async () => {
    const { notApplicableRules } = await onContent("<html lang='en'><body><p>Bare.</p></body></html>");
    assert.ok(notApplicableRules.includes("design-mobile-first"));
  });

  test("Arabic copy cannot evidence the British-English item", async () => {
    const { notApplicableRules, findings } = await onContent(
      "<html lang='ar' dir='rtl'><body><p>هذه صفحة عربية بالكامل ولا تحتوي على نص إنجليزي.</p></body></html>",
    );
    assert.ok(notApplicableRules.includes("design-british-english"));
    assert.ok(!findings.some((f) => f.ruleId === "design-british-english"));
  });

  test("inline script/style source is not copy — an Arabic page stays Arabic", async () => {
    // Regression: textContent concatenates <script>/<style> source, which on a
    // script-heavy portal outweighed the real copy and made fnrc.gov.ae — an
    // 82% Arabic page mislabelled lang="en" — read as English, then matched
    // the CSS property names "color" and "center" as American spelling.
    const { notApplicableRules, findings } = await onContent(
      `<html lang="en"><head><style>
         .a { color: #fff; text-align: center; }
         .b { background-color: #000; }
       </style></head><body>
         <p>هذه صفحة عربية بالكامل ولا تحتوي على نص إنجليزي حقيقي على الإطلاق.</p>
         <script>const color = "center"; function organize(){ return color; }</script>
       </body></html>`,
    );
    assert.ok(
      notApplicableRules.includes("design-british-english"),
      "script/style text must not make an Arabic page look English",
    );
    assert.ok(!findings.some((f) => f.ruleId === "design-british-english"));
  });

  test("those rules land on their items as not-checked, not as clean", async () => {
    const { notApplicableRules } = await onContent(
      "<html lang='ar' dir='rtl'><body><p>عربي فقط.</p></body></html>",
    );
    const view = buildChecklistView([], { notApplicableRules });
    const status = (id) => view.machineCheckedItems.find((i) => i.id === id).status;
    assert.equal(status("1.15"), "not-checked");
    assert.equal(status("2.33"), "not-checked");
  });
});

describe("2.26 — the container measured at the 1536px canvas", () => {
  const page = (css, body = "<h1>Heading</h1><p>Copy for the sample.</p>") =>
    `<html lang="en"><head><style>${css}</style></head><body>${body}</body></html>`;

  async function responsive(html) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await p.setContent(html);
      return await runResponsiveDesignChecks(p);
    } finally {
      await p.close();
    }
  }

  test("a container near 1480px at the 1536px canvas is accepted", async () => {
    const { findings } = await responsive(
      page("p{font-size:16px}h1{font-size:28px}.wrap{max-width:1480px;margin:0 auto}",
        '<div class="wrap"><h1>H</h1><p>Copy for the sample.</p></div>'),
    );
    assert.ok(!findings.some((f) => f.ruleId === "design-canvas-container"),
      findings.map((f) => f.ruleId).join(","));
  });

  test("a container far from 1480px reports the measured width", async () => {
    const { findings } = await responsive(
      page("p{font-size:16px}h1{font-size:28px}.wrap{max-width:960px;margin:0 auto}",
        '<div class="wrap"><h1>H</h1><p>Copy for the sample.</p></div>'),
    );
    const f = findings.find((x) => x.ruleId === "design-canvas-container");
    assert.ok(f, findings.map((x) => x.ruleId).join(","));
    assert.match(f.message, /960px/);
    // Must not overclaim: the item asks about wireframes, this measures the build.
    assert.match(f.message, /does not speak to whether the wireframes/i);
  });

  test("no constrained container at all is not-applicable, not a pass", async () => {
    const { notApplicableRules } = await responsive(page("p{font-size:16px}h1{font-size:28px}"));
    assert.ok(notApplicableRules.includes("design-canvas-container"), notApplicableRules.join(","));
  });
});

describe("3.63 — og:image dimensions", () => {
  // 1x1 and 1200x630 PNGs as data URIs, so no network is involved.
  const tiny =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  test("an undersized og:image flags with its measured size", async () => {
    const { findings } = await onContent(
      `<html lang="en"><head><meta property="og:image" content="${tiny}"></head><body><p>x</p></body></html>`,
    );
    const f = findings.find((x) => x.ruleId === "design-og-image-size");
    assert.ok(f, findings.map((x) => x.ruleId).join(","));
    assert.match(f.message, /1×1/);
    assert.match(f.message, /1200×630/);
  });

  test("no og:image is not-applicable here — that gap belongs to 3.36", async () => {
    const { notApplicableRules, findings } = await onContent(
      "<html lang='en'><body><p>No open graph tags.</p></body></html>",
    );
    assert.ok(notApplicableRules.includes("design-og-image-size"));
    assert.ok(!findings.some((f) => f.ruleId === "design-og-image-size"));
  });
});

describe("a stale browser notice is not the same as having one", () => {
  test("a notice naming 2010-era browsers flags as stale", async () => {
    // The real fujmun.gov.ae footer shape.
    const { findings } = await onContent(
      "<html lang='en'><body><footer>Best viewed at 1280x1024 supporting Microsoft Edge, " +
        "Firefox 10+, Chrome 5+, Safari 1+, Opera 12+</footer></body></html>",
    );
    const ids = findings.map((f) => f.ruleId);
    assert.ok(ids.includes("design-browser-notice-stale"), ids.join(","));
  });

  test("a current-sounding notice is accepted", async () => {
    const { findings } = await onContent(
      "<html lang='en'><body><div>Your browser is not supported — please update your browser.</div></body></html>",
    );
    const ids = findings.map((f) => f.ruleId);
    assert.ok(!ids.includes("design-browser-notice-stale"));
  });
});
