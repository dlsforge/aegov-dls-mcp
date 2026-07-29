/**
 * Block conformance contracts — the docs-tier invariants for the header and
 * footer blocks (TDRA items 3.19–3.22 and 2.40 downstream in Mizan).
 *
 * Two things are pinned here:
 *  1. INTEGRITY — every requirement's citation really occurs on the docs page it
 *     claims, re-checked against inventory/docs.json independently of the build
 *     script that asserted it, and each contract still matches the page hash it
 *     was authored against.
 *  2. EVALUATION — satisfied / violated / not-applicable for each check kind,
 *     including the case that drove the design: the docs header ships TWO
 *     `ul.nav-menu` lists of exactly 7 items, so a document-wide count would
 *     read 14 and fail the design system's own example.
 *
 * Run: npm run build && node --test test/block-contracts.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadCatalog,
  blockProbeSpec,
  checkBlockContracts,
  checkBlockSnippet,
  staleBlockContracts,
  groupKey,
} from "../dist/index.js";

const catalog = loadCatalog();
const contracts = catalog.blockContracts;
const docs = JSON.parse(readFileSync("inventory/docs.json", "utf8"));

const byId = (id) => contracts.flatMap((c) => c.requirements).find((r) => r.id === id);
const resultFor = (results, id) => results.find((r) => r.requirementId === id);

/** A probe where nothing matches — the "block absent" baseline. */
/**
 * A probe of a page that has none of the block markup on it.
 *
 * Every selector is explicitly 0 — which is what a real DOM probe returns for a
 * blank page ("asked, matched nothing"), and what distinguishes it from a key
 * the consumer never reported at all ("never asked"). The two must not be
 * conflated: the first is a violation, the second is not-applicable.
 */
const emptyProbe = (currentYear = 2026) => {
  const spec = blockProbeSpec(contracts);
  return {
    counts: Object.fromEntries(spec.present.map((s) => [s, 0])),
    groupCounts: {},
    texts: {},
    currentYear,
  };
};

/** Build a probe that satisfies every requirement. */
function conformingProbe(currentYear = 2026) {
  const spec = blockProbeSpec(contracts);
  const counts = Object.fromEntries(spec.present.map((s) => [s, 1]));
  const groupCounts = Object.fromEntries(
    spec.groups.map((g) => [groupKey(g.groupSelector, g.childSelector), [7, 7]]),
  );
  const texts = Object.fromEntries(spec.texts.map((s) => [s, `© ${currentYear} Entity. All rights reserved.`]));
  return { counts, groupCounts, texts, currentYear };
}

describe("contract integrity", () => {
  test("header and footer contracts exist with requirements", () => {
    assert.deepEqual(
      contracts.map((c) => c.blockId).sort(),
      ["footer", "header"],
    );
    assert.equal(contracts.flatMap((c) => c.requirements).length, 6);
    for (const c of contracts) {
      assert.ok(c.requirements.length > 0, `${c.blockId} has no requirements`);
      assert.match(c.provenance.sourceUrl, /^https:\/\/designsystem\.gov\.ae\/docs\/blocks\//);
      assert.equal(c.provenance.tier, "docs");
    }
  });

  test("every citation occurs verbatim on its docs page", () => {
    for (const contract of contracts) {
      const page = docs.pages.find((p) => p.section === "blocks" && p.slug === contract.blockId);
      assert.ok(page, `no docs page for block ${contract.blockId}`);
      const block = catalog.blocks.find((b) => b.id === contract.blockId);
      const pageText = page.sections.map((s) => s.text).join(" ");
      const pageMarkup = [block.markup, ...block.examples]
        .filter(Boolean)
        .map((m) => m.html)
        .join("\n");

      for (const req of contract.requirements) {
        const haystack = req.evidence.kind === "guidance" ? pageText : pageMarkup;
        assert.ok(
          haystack.includes(req.evidence.quote),
          `${req.id}: ${req.evidence.kind} citation not found on ${page.url}: ${req.evidence.quote}`,
        );
      }
    }
  });

  test("no contract has drifted from the page it was authored against", () => {
    assert.deepEqual(staleBlockContracts(contracts), []);
    for (const c of contracts) assert.equal(c.sourceContentHash, c.provenance.contentHash);
  });

  test("the staleness check can actually fail (it is not a tautology)", () => {
    // Regression: sourceContentHash used to be copied out of the extraction at
    // build time, so it moved with the page and could never disagree. The
    // reviewer's hash is now a literal in scripts/block-contracts.mjs and the
    // BUILD fails on mismatch; this pins that the runtime check still detects a
    // catalogue where they diverge.
    const drifted = contracts.map((c, i) =>
      i === 0 ? { ...c, provenance: { ...c.provenance, contentHash: "0".repeat(64) } } : c,
    );
    assert.deepEqual(
      staleBlockContracts(drifted).map((c) => c.blockId),
      [contracts[0].blockId],
    );
  });

  test("the 7-item navigation limit matches the sentence it cites", () => {
    const req = byId("header.nav-max-items");
    assert.equal(req.check.max, 7);
    assert.match(req.evidence.quote, /cannot be more than 7 elements/);
  });
});

describe("probe spec", () => {
  test("collects every selector the contracts need, deduplicated", () => {
    const spec = blockProbeSpec(contracts);
    assert.ok(spec.present.includes("header.aegov-header"));
    assert.ok(spec.present.includes("footer.aegov-footer"));
    assert.deepEqual(spec.texts, ["footer.aegov-footer"]);
    assert.equal(spec.groups.length, 1);
    assert.equal(spec.groups[0].groupSelector, "header.aegov-header ul.nav-menu");
    assert.equal(new Set(spec.present).size, spec.present.length, "present selectors not deduplicated");
  });
});

describe("snippet path (no DOM)", () => {
  const snippet = (html) => checkBlockSnippet(html, contracts);

  test("a fragment that is not a documented block is not judged as one", () => {
    assert.deepEqual(snippet(`<button class="aegov-btn" type="submit">Send</button>`), []);
    assert.deepEqual(snippet(`<div class="card"><p>hello</p></div>`), []);
  });

  test("a header without any mobile affordance is flagged", () => {
    const [header] = snippet(
      `<header class="aegov-header"><nav><ul class="nav-menu"><li><a href="/">Home</a></li></ul></nav></header>`,
    );
    assert.equal(header.blockId, "header");
    assert.equal(header.findings.length, 1);
    assert.equal(header.findings[0].confidence, "docs", "blocks are docs-tier, never package-tier");
    assert.match(header.findings[0].message, /mobile menu affordance/);
    assert.match(header.findings[0].message, /designsystem\.gov\.ae/, "the docs URL should travel with the finding");
  });

  test("any one of the documented toggle attributes satisfies it", () => {
    for (const attr of ['data-modal-toggle="m"', 'aria-controls="m"', 'aria-expanded="false"']) {
      const [header] = snippet(`<header class="aegov-header"><button type="button" ${attr}>Menu</button></header>`);
      assert.deepEqual(header.findings, [], attr);
    }
  });

  test("a footer without the mobile accordion is flagged, with it is clean", () => {
    const [bare] = snippet(`<footer class="aegov-footer"><a href="/a">A</a></footer>`);
    assert.equal(bare.findings.length, 1);
    assert.match(bare.findings[0].message, /accordion/);

    const [ok] = snippet(
      `<footer class="aegov-footer"><nav class="aegov-accordion aegov-mobile-accordion" data-accordion="collapse"></nav></footer>`,
    );
    assert.deepEqual(ok.findings, []);
  });

  test("the root requirement is not re-reported as a finding", () => {
    // Its presence is what made the contract apply; repeating it is noise.
    const [header] = snippet(`<header class="aegov-header" data-modal-toggle="m"></header>`);
    assert.deepEqual(header.findings, []);
  });

  test("what a fragment cannot answer is named, not silently passed", () => {
    const [header] = snippet(`<header class="aegov-header" aria-controls="m"></header>`);
    assert.deepEqual(
      header.notCheckable.map((n) => n.requirementId),
      ["header.nav-max-items"],
    );
    assert.match(header.notCheckable[0].reason, /rendered/);

    const [footer] = snippet(
      `<footer class="aegov-footer"><nav class="aegov-mobile-accordion"></nav></footer>`,
    );
    assert.deepEqual(
      footer.notCheckable.map((n) => n.requirementId),
      ["footer.copyright-year"],
    );
  });

  test("both blocks in one snippet are reported separately", () => {
    const res = snippet(
      `<header class="aegov-header" aria-controls="m"></header><footer class="aegov-footer"></footer>`,
    );
    assert.deepEqual(res.map((r) => r.blockId), ["header", "footer"]);
  });

  test("every snippet signal names something its own selector asks for", () => {
    // Guards the two paths against drifting apart: the no-DOM signal must be
    // derivable from the selector the DOM path evaluates.
    for (const c of contracts) {
      for (const r of c.requirements) {
        if (!r.snippetSignal) continue;
        const selector = r.check.kind === "count-max" ? r.check.groupSelector : r.check.selector;
        if (r.snippetSignal.kind === "class") {
          assert.ok(selector.includes(`.${r.snippetSignal.value}`), `${r.id}: ${r.snippetSignal.value}`);
        } else {
          for (const a of r.snippetSignal.anyOf) {
            assert.ok(selector.includes(`[${a}]`), `${r.id}: ${a}`);
          }
        }
      }
    }
  });
});

describe("evaluation", () => {
  test("a conforming page violates nothing", () => {
    const results = checkBlockContracts(contracts, conformingProbe());
    assert.deepEqual(
      results.filter((r) => r.status === "violated"),
      [],
    );
    assert.equal(results.length, 6);
  });

  test("two 7-item navigations pass — the docs' own header must not fail", () => {
    // The design system ships desktop + mobile lists of 7 each. Counted per
    // group this is fine; counted document-wide it would read 14 and fail.
    const probe = conformingProbe();
    probe.groupCounts[groupKey("header.aegov-header ul.nav-menu", ":scope > li")] = [7, 7];
    const r = resultFor(checkBlockContracts(contracts, probe), "header.nav-max-items");
    assert.equal(r.status, "satisfied");
  });

  test("an 8-item navigation is a violation naming the count", () => {
    const probe = conformingProbe();
    probe.groupCounts[groupKey("header.aegov-header ul.nav-menu", ":scope > li")] = [8, 7];
    const r = resultFor(checkBlockContracts(contracts, probe), "header.nav-max-items");
    assert.equal(r.status, "violated");
    assert.equal(r.severity, "error");
    assert.match(r.message, /8 top-level items \(limit 7\)/);
    assert.ok(r.fix);
  });

  test("missing block roots are violations, and gated requirements go not-applicable", () => {
    const results = checkBlockContracts(contracts, emptyProbe());
    assert.equal(resultFor(results, "header.root").status, "violated");
    assert.equal(resultFor(results, "footer.root").status, "violated");
    // Never a silent pass for things that could not be looked at.
    for (const id of ["header.mobile-menu", "header.nav-max-items", "footer.mobile-accordion", "footer.copyright-year"]) {
      assert.equal(resultFor(results, id).status, "not-applicable", `${id} should be not-applicable`);
    }
  });

  test("a header without any mobile affordance is flagged", () => {
    const probe = conformingProbe();
    probe.counts[byId("header.mobile-menu").check.selector] = 0;
    const r = resultFor(checkBlockContracts(contracts, probe), "header.mobile-menu");
    assert.equal(r.status, "violated");
    assert.equal(r.severity, "warning");
  });

  test("a footer without the mobile accordion is flagged", () => {
    const probe = conformingProbe();
    probe.counts["footer.aegov-footer .aegov-mobile-accordion"] = 0;
    const r = resultFor(checkBlockContracts(contracts, probe), "footer.mobile-accordion");
    assert.equal(r.status, "violated");
  });

  describe("a query the consumer could not run", () => {
    test("is not-applicable, not a violation", () => {
      // Regression: a selector the browser rejected left its key absent from
      // the probe, which read as a count of zero and reported the requirement
      // VIOLATED — asserting a defect on a page nothing had looked at.
      const probe = conformingProbe();
      const sel = byId("header.mobile-menu").check.selector;
      delete probe.counts[sel];
      probe.unavailable = [sel];
      assert.equal(
        resultFor(checkBlockContracts(contracts, probe), "header.mobile-menu").status,
        "not-applicable",
      );
    });

    test("an unavailable gate takes the whole requirement out of play", () => {
      const probe = conformingProbe();
      probe.unavailable = ["header.aegov-header ul.nav-menu"];
      assert.equal(
        resultFor(checkBlockContracts(contracts, probe), "header.nav-max-items").status,
        "not-applicable",
      );
    });

    test("a selector the consumer never reported at all is not-applicable", () => {
      // Adversarial pass 2026-07-29: a consumer that simply OMITS a key (rather
      // than declaring it unavailable) had it read as a count of zero, so the
      // library reported "the page has no DLS footer" against a page it had
      // never measured. An unasked question has no answer.
      const probe = { counts: { "header.aegov-header": 1 }, groupCounts: {}, texts: {}, currentYear: 2026 };
      const results = checkBlockContracts(contracts, probe);
      assert.equal(resultFor(results, "footer.root").status, "not-applicable");
      assert.equal(resultFor(results, "header.mobile-menu").status, "not-applicable");
      // Nothing may be asserted as violated from an unmeasured probe.
      assert.deepEqual(results.filter((r) => r.status === "violated"), []);
    });

    test("an explicit zero is still a violation (asked, matched nothing)", () => {
      const probe = conformingProbe();
      probe.counts["footer.aegov-footer"] = 0;
      assert.equal(
        resultFor(checkBlockContracts(contracts, probe), "footer.root").status,
        "violated",
      );
    });

    test("an unavailable group query is not-applicable", () => {
      const probe = conformingProbe();
      const key = groupKey("header.aegov-header ul.nav-menu", ":scope > li");
      probe.groupCounts[key] = [99];
      probe.unavailable = [key];
      assert.equal(
        resultFor(checkBlockContracts(contracts, probe), "header.nav-max-items").status,
        "not-applicable",
      );
    });
  });

  describe("copyright year", () => {
    test("a stale year is a violation naming both years", () => {
      const probe = conformingProbe(2026);
      probe.texts["footer.aegov-footer"] = "© 2021 Some Entity. All rights reserved.";
      const r = resultFor(checkBlockContracts(contracts, probe), "footer.copyright-year");
      assert.equal(r.status, "violated");
      assert.match(r.message, /2021/);
      assert.match(r.message, /2026/);
    });

    test("a range containing the current year passes", () => {
      const probe = conformingProbe(2026);
      probe.texts["footer.aegov-footer"] = "© 2019-2026 Some Entity. All rights reserved.";
      assert.equal(
        resultFor(checkBlockContracts(contracts, probe), "footer.copyright-year").status,
        "satisfied",
      );
    });

    test("a year in Arabic-Indic digits is not-applicable, never a violation", () => {
      // An Arabic page may render the year as ٢٠٢٦. The check reads ASCII
      // years only, so it must decline to judge rather than call it stale.
      const probe = conformingProbe(2026);
      probe.texts["footer.aegov-footer"] = "© ٢٠٢٦ وزارة المثال. جميع الحقوق محفوظة.";
      assert.equal(
        resultFor(checkBlockContracts(contracts, probe), "footer.copyright-year").status,
        "not-applicable",
      );
    });

    test("no year at all is not-applicable, never a violation", () => {
      // The line may be absent or rendered as an image; that is not evidence of
      // a stale year, so the contract must not assert either way.
      const probe = conformingProbe(2026);
      probe.texts["footer.aegov-footer"] = "All rights reserved.";
      assert.equal(
        resultFor(checkBlockContracts(contracts, probe), "footer.copyright-year").status,
        "not-applicable",
      );
    });
  });
});
