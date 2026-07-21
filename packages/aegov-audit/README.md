# @dlsforge/aegov-audit — Mizan (ميزان)

**Compliance & accessibility auditor for UAE government websites.** Mizan loads a rendered page in a real browser and checks it against the AEGOV Design Language System and the TDRA assessment criteria — WCAG accessibility, Lighthouse scores, and the DLS-specific rules generic tools cannot do — then produces a machine-readable report plus a human report shaped to mirror the official TDRA assessment checklist.

> **Community project. Not affiliated with or endorsed by TDRA.**
>
> **A clean automated run is NOT compliance.** Automated checks cover only a machine-checkable subset of the standard; the report always states which items still need human review. Arabic/RTL parity findings are flags for a native speaker to confirm — Mizan never asserts parity as settled fact.

Mizan (ميزان — *scale/balance*) is the verification counterpart to [`@dlsforge/aegov-mcp`](https://www.npmjs.com/package/@dlsforge/aegov-mcp), which helps assistants *generate* correct government UI. Same standard, opposite direction: the MCP server writes it, Mizan checks it — both enforcing the exact same rules from the shared [`@dlsforge/aegov-rules-core`](https://www.npmjs.com/package/@dlsforge/aegov-rules-core).

## What it checks

Over the **rendered DOM** (post-JavaScript, with computed styles — so it sees what `validate_snippet` never could):

- **axe-core** — WCAG 2.2 AA machine-checkable success criteria.
- **Lighthouse** — Performance / Accessibility / SEO / Best-Practices, plus LCP/FCP, evaluated against the verified TDRA thresholds **under documented local run conditions** (see below). Specific audits also become checklist evidence: render-blocking CSS, unminified CSS/JS, cache policy, third-party impact, and the checklist's own page-weight budgets (≤ 500 KB excluding images, ≤ 4 MB total).
- **Document & asset checks** — skip-to-content link, favicon variants, theme-colour meta, Open Graph tags, semantic HTML5 landmarks, `rel="noopener"`, icon `aria-hidden`/supporting text, font sourcing, script placement, cookie banner.
- **Media checks** — `srcset`/`<picture>` responsive images (incl. the hero block), lazy loading, WebP-first delivery, adaptive video hosting.
- **Origin probes** (http(s) targets) — `sitemap.xml` (robots.txt-aware) and designed 404 error pages (soft-404 and bare-server-default detection).
- **Computed-style checks against the resolved DLS tokens** — approved font families and heading weights, neutral background palette, AEBLACK-800 primary text, AEGOLD-600 on action elements, section (3:1) and action-element (4.5:1) contrast sweeps, 24px minimum rendered icon size, and — with `--entity-type ministry` — the ministries-only AEGOLD/AEBLACK primary palette. Colour comparison happens in canonical sRGB against the token values from `rules-core`; nothing is hard-coded.
- **Interaction checks** — layout reflow at 175% zoom (horizontal-overflow detection), a bounded real-keyboard tab walk (regions whose controls are never reachable), and visible focus indication on every element the walk visits (fail-soft: an aborted walk reports "not checked", never a guess).
- **Bounded same-origin crawl** (http(s) targets; home + up to 6 linked pages, robots.txt honoured, self-identifying User-Agent; `--no-crawl` to skip) — unique per-page titles/descriptions, alternate-hreflang on every crawled page, and a heuristic Page-Rating-block presence check on service-looking pages.
- **DLS rules** (the differentiator) — official-component usage vs hand-rolled markup, design-token fidelity, component structure, mandatory **UAE Pass** on any login, **Emirates ID** format `784-NNNN-NNNNNNN-N` with masking + pattern validation, DMY dates, document metadata, and **Arabic/RTL parity** between language variants.

Together these attach direct evidence to **53 of the 125 TDRA checklist items** (fully or partially). The report says exactly which — and marks the rest as needing a human answer; items whose evidence engine didn't run in a given invocation (e.g. Lighthouse without `--lighthouse`, the crawl on a local file, item 2.12 without `--entity-type ministry`) read **"not checked"**, never "no findings".

Every finding carries a severity, the rule, its provenance/confidence tier (`package | docs | heuristic | external`), and a fix.

## Requirements

- **Node.js ≥ 22.19** (Lighthouse 13 needs it).
- A Chromium browser. Playwright's is used by default; `npx playwright install chromium` fetches it. Set `CHROME_PATH` to point at a system Chrome instead.

## CLI

```sh
npx @dlsforge/aegov-audit <url|path> [options]
```

```
<url|path>     An http(s):// URL or a local HTML file to audit.
--json         Emit the full machine report as JSON on stdout.
--lighthouse   Also run Lighthouse (http(s) only; slower — two full page loads).
--parity [url] Also load the other-language variant (given URL, or discovered via
               <link hreflang>) and flag structural differences for human review.
--out <dir>    Write report.json + report.md (mirroring the TDRA checklist) into <dir>.
--format xlsx  Additionally write report.xlsx into --out <dir>: a COPY of TDRA's own
               assessment workbook with the "Reason" column pre-filled with Mizan's
               evidence. The "Validate" column is never touched — that self-assessment
               belongs to the entity, and Mizan never writes "Completed" anywhere.
--xlsx-template <path>
               Use a local copy of the TDRA workbook as the template (default: the
               cached copy, else a fresh download from designsystem.gov.ae — the
               workbook is TDRA's file and is never shipped inside this package).
--no-crawl     Skip the bounded same-origin crawl (on by default for http(s)
               targets; answers the multi-page checklist items).
--entity-type <type>
               The audited entity's type. "ministry" additionally enables the
               ministries-only AEGOLD/AEBLACK palette check (checklist 2.12).
--fail-on <s>  Exit 1 when any finding is at or above severity <s>
               (critical > serious > moderate > minor). Default: none — report only.
```

**Examples**

```sh
# Quick console audit of a built page
npx @dlsforge/aegov-audit ./dist/index.html

# Full reviewer-ready report with Lighthouse and Arabic parity
npx @dlsforge/aegov-audit https://example.gov.ae/en/service \
  --lighthouse --parity https://example.gov.ae/ar/service --out ./mizan-report

# The same, plus TDRA's own workbook pre-filled with the evidence
npx @dlsforge/aegov-audit https://example.gov.ae/en/service \
  --lighthouse --out ./mizan-report --format xlsx

# CI gate: fail the build on any critical finding
npx @dlsforge/aegov-audit ./dist/index.html --fail-on critical
```

## GitHub Action — audit on every change

A reusable composite action lives in this package. Point it at a built HTML file or a deployed URL; it fails the build on findings at or above `fail-on` (default critical), annotates the rest as warnings, and uploads the full report as an artifact.

```yaml
- uses: dlsforge/aegov-dls-mcp/packages/aegov-audit/action@main # pin a tag/SHA in real pipelines
  with:
    url: dist/index.html # or a deployed http(s) URL
    fail-on: critical
    lighthouse: "true" # optional; http(s) only
    parity: auto # optional; hreflang discovery, or an explicit URL
```

Full inputs/outputs: [`action/README.md`](action/README.md).

## Lighthouse run conditions matter

Lighthouse scores depend on machine, network throttling, and device emulation. Mizan runs Lighthouse under its **default simulated throttling on the local machine** and records the exact conditions in every report. Those numbers are comparable across your own local runs, **not** to TDRA's environment — so the report evaluates them against the TDRA thresholds only under that explicit local-run caveat. On Linux CI runners it adds `--no-sandbox` (recorded in the run conditions) because unprivileged user namespaces are typically restricted there.

## TDRA thresholds (verified 2026-07-12)

Stated on the [assessment-criteria page](https://designsystem.gov.ae/resources/assessment-criteria) (not inside the workbook): Lighthouse **Accessibility / Performance / SEO ≥ 90; Best Practices ≥ 80** on both desktop and mobile; **LCP ≤ 2.5 s, FCP ≤ 1.8 s**. The workbook's own accessibility baseline is **WCAG 2.1 AA** (Mizan reports against 2.2 AA and 2.1 both). The committed extraction is `reference/tdra-assessment-criteria.json` (checklist v2.0, published 2023-09-26, 125 items); re-check per release with `npm run tdra:fetch && npm run tdra:extract`.

## Reports are private

Mizan produces a **private report for the site's own team**. It does not rank or score government sites publicly — there is no scoreboard, by design.

## License

MIT — see [LICENSE](../../LICENSE). Community project. Not affiliated with or endorsed by TDRA.
