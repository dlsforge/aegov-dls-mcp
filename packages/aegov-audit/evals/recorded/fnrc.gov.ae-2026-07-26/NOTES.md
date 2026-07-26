# Recorded run — fnrc.gov.ae (Fujairah Natural Resources Corporation), 2026-07-26

> Private report produced for the site's own team (the repo owner), committed here with the owner's standing approval as the recorded-run evidence (same arrangement as the 2026-07-12/20/21/22 runs). Community project — not affiliated with or endorsed by TDRA.

## What this run demonstrates vs the 2026-07-22 recording

The **docs-sourced block contracts** in `@dlsforge/aegov-rules-core` closed the last formally-deferred slice of Stage 2B, taking coverage from **61 to 66 of 125 items**: 3.19/3.20 (header), 3.21/3.22 (footer) and the 2.40 roll-up.

The invariants are not hand-written in Mizan. They live in the catalogue as contracts bound to the docs page they were authored from — each requirement citing the sentence or the markup that mandates it, verified verbatim at catalogue build time, and pinned to that page's `contentHash` so a docs change makes the staleness visible instead of silently invalidating the rule.

## Run conditions

- `aegov-audit https://fnrc.gov.ae --lighthouse --format xlsx --out …` — headless Chromium (Playwright 1.61.1 pinned), axe-core 4.12.1, Lighthouse 13.4.0 (both form factors, simulated throttling), html-validate 11.5.6, local machine (Windows x64), 2026-07-26. Exact conditions inside `report.json`/`report.md`.
- Docs snapshot re-fetched 2026-07-26 and re-extracted: **zero content drift across all 42 pages** since the 2026-07-07 capture, so the block contracts rest on docs confirmed current.
- Crawl, parity and `--entity-type` posture identical to 2026-07-22 (no parity leg — one-URL culture-cookie architecture; no ministry flag).

## What the block contracts found — and where they stayed silent

The site is Bootstrap end to end and ships zero `aegov-*` classes, which makes it the sharpest available test of the zero-false-positive posture:

- **3.19 / 3.21 — findings.** `blk-header-root` and `blk-footer-root`: the page's header and footer are not the design system's blocks. Both are decisive, structural facts, not judgments.
- **2.40 — findings.** The roll-up of both roots ("approved header and footer elements without change").
- **3.20 / 3.22 — "not-checked", deliberately.** There is no DLS header or footer on the page, so there was no mobile menu or footer accordion to judge. Reporting "no automated findings" here would read as a pass for something Mizan never looked at. This is the gating behaviour the contracts were designed around and it is pinned by test.
- **`blk-header-nav-max-items` and `blk-footer-copyright-year` did not fire** — their anchors (a `ul.nav-menu`, a year in the footer of a DLS footer block) are absent, so they reported not-applicable rather than guessing at a Bootstrap navbar's structure.

Everything else is unchanged from 2026-07-22 (98 W3C source errors, Font Awesome 4.5 vs the guideline's Phosphor, 10/75 elements without a focus indicator, the token/contrast findings, page-weight budgets).

## Headline results (local run conditions — NOT comparable to TDRA's environment)

- **38 of 66** machine-checked items have findings; **59 of 125** items need human review.
- Lighthouse (mobile): performance 26, accessibility 87, best-practices 85, seo 82.
- Lighthouse (desktop): performance 43, accessibility 73, best-practices 85, seo 82.

## Deliberate non-checks (unchanged posture)

Considered while authoring the contracts and **not** written, because no anchor exists that would not produce false positives on real government sites:

- *"The logo must be an SVG file, and must not exceed 110px in height"* — a skip link routinely precedes the logo anchor, so "the logo" cannot be pinned reliably; the docs also hedge the height for authorities ("you must aim not to exceed").
- *The secondary-navigation icon set* (login / accessibility / language) — entities localize labels and ids, so absence is not distinguishable from renaming.
- *"The first element must be a link to the homepage"* — locale roots (`/`, `/en`, `/ar`, culture-cookie sites) make "is this the homepage" unreliable.

## Incidental observation worth carrying forward

The design system's own footer block markup gives its accordion panels `aria-labelledby` on a bare `<div>`, which `html-validate`'s `aria-label-misuse` rule (item 3.40) rejects — an element with no role may not carry it. The compliant eval fixture adds `role="region"` to those panels, which is both valid and the correct accordion-panel role. Not a Mizan defect; a defect in the documented markup, worth reporting upstream.
