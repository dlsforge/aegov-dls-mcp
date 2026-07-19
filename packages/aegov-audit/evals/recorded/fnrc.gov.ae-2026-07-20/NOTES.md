# Recorded run — fnrc.gov.ae (Fujairah Natural Resources Corporation), 2026-07-20

> Private report produced for the site's own team (the repo owner), committed here with the owner's standing approval as the Stage-2B recorded-run evidence (STAGE2B-HANDOFF §3, same arrangement as the 2026-07-12 step-7 run). Community project — not affiliated with or endorsed by TDRA.

## What this run demonstrates vs the 2026-07-12 recording

Stage 2B expanded the machine-checked TDRA checklist coverage from **14 to 39 of 125 items**: Lighthouse-derived evidence (render-blocking, minification, cache policy, third-party impact, and the checklist's own page-weight budgets), document/asset DOM rules (skip link, favicon, theme-colour, Open Graph, semantic HTML5, `rel=noopener`, icon accessibility, fonts, script placement, cookie banner), media rules (srcset/picture, lazy loading, WebP, video delivery), and origin probes (sitemap.xml, designed error pages). It also introduced `--format xlsx`.

## Run conditions

- `aegov-audit https://fnrc.gov.ae --lighthouse --format xlsx --out …` — headless Chromium (Playwright 1.61.1 pinned binary), axe-core 4.12.1, Lighthouse 13.4.0 (both form factors, simulated throttling), local machine (Windows x64), 2026-07-20. Exact conditions are inside `report.json`/`report.md`.
- The site still client-redirects `/` → `/portal/home/index`; the navigation-settle handling from step 7 applies.
- No `--parity` leg, for the same reason as 2026-07-12: both languages are served at one URL via a server-side culture cookie (not URL-addressable), so side-by-side parity loading does not apply. The architecture is itself flagged (`meta-alternate`).

## About `report.xlsx` (not committed)

This run also produced `report.xlsx` — a copy of TDRA's own assessment workbook ("Ministry Checksheet") with the **Reason column (F) pre-filled** for all 125 items: automated evidence on the machine-checked items, an explicit "NOT a pass" note on clean machine-checked items, and "requires human answer" on the rest. The **Validate column (E) is never written** — that self-assessment belongs to the entity — and the writer refuses to emit the word "Completed" anywhere. The file is deliberately **gitignored**: a filled copy embeds TDRA's own workbook, which this repo never redistributes. Structural verification of the produced file (125 Reason cells, E-column untouched, TDRA styles byte-identical, banner disclaimer in H1) is pinned by `test/xlsx.test.mjs` and was additionally confirmed against this run's artifact.

## Cross-check: Mizan vs two independent blind reviews

Two independent expert reviews (accessibility/technical-standards; TDRA-checklist/technical) were run **blind** against the live site — no access to Mizan's report — then diffed against `report.json`.

### Verdict

- **No fabricated finding:** every Mizan finding was independently confirmed — wrong `lang` on an Arabic page, missing `dir`, no canonical/hreflang, no theme-colour, no Open Graph, missing/placeholder alt text (the blind count of placeholder alts matched exactly: 16× "Image Placeholder", 6× "Alternate Text"), unnamed icon-only controls, no skip link, heading/landmark defects, synchronous head scripts, zero srcset/lazy/WebP across ~120 images, missing `rel=noopener`, unminified first-party CSS/JS (blind spot-check: `bootstrap.css` 234 KB unminified), page weight far over the checklist budgets, no sitemap.xml, no robots.txt, and zero `aegov-*` classes (`dls-not-used`).
- **Correctly quiet where the site conforms:** doctype/charset/viewport, the declared favicon, the on-page consent UI, and the absence of a login surface (no UAE Pass false-positive) all produced no findings in Mizan and were confirmed clean/absent by the blind reviews.
- **One machine-checkable miss found and fixed during this comparison** (the eval loop working as designed): the site's root-level 404s serve the **raw IIS default error page** (~1.2 KB — above the writer's bare-size threshold), which the original signature list (nginx/Apache-centric) did not recognize. The `http-error-page` signatures now include IIS's actual wording, the case is pinned in `test/tier-b.test.mjs`, and this recording was produced after the fix (the finding appears in the report).

### Documented machine-check boundaries (blind findings Mizan intentionally does NOT claim)

1. **Empty meta description / missing `<title>` on the error page** — meta-description quality is SEO-tier outside the machine-checked set; per-page title uniqueness (checklist 3.29) needs a multi-page crawl (planned Tier D).
2. **`/portal/*` soft-404 behavior** — deep routes redirect to a designed error page that answers HTTP 200. Mizan's single origin probe found the root-level bare-default breach; it does not crawl deep routes by design (Tier D scope).
3. **Semantic-structure judgment** — the page has *some* semantic elements (footer, nav, section) but no `<main>`/`<header>`; Mizan's `dom-semantic-tags` fires only on a fully div-based page (conservative all-or-nothing), and the gap is covered by axe's landmark findings in the same report.
4. **Duplicate third-party libraries** (two Font Awesome versions), **infrastructure header leakage** (F5 BIG-IP cookie naming, `aspxerrorpath` parameter) — content-quality/infra-security observations outside the TDRA checklist's machine-checked set.
5. **Keyboard operability, carousel behavior, hidden-content defects, language-of-parts, Arabic wording quality** — the standing human-review boundaries from the 2026-07-12 run all still apply.

## Headline results (local run conditions — NOT comparable to TDRA's environment)

- **24 of the 39 machine-checked checklist items carry findings** (2.35, 2.42, 3.4, 3.6, 3.8, 3.9, 3.12, 3.31–3.36, 3.38, 3.39, 3.46, 3.48–3.51, 3.53, 3.54, 3.57, 3.64); 86 of 125 items need human review. In the 2026-07-12 recording, the machine-checked set was only 14 items.
- Page weight far over the checklist budgets: **8.5–9.2 MB total vs the 4 MB budget** (item 3.54) and **1.5–2.2 MB excluding images vs 500 KB** (item 3.53) — transfer sizes of this local load.
- Lighthouse mobile: performance 26, accessibility 87, best-practices 65, SEO 82; desktop: 24/73/69/82. TDRA thresholds (A11y/Perf/SEO ≥ 90, BP ≥ 80, LCP ≤ 2.5 s, FCP ≤ 1.8 s) are **not met under local conditions**.
- The full findings are in `report.json` (machine) and `report.md` (TDRA-checklist-shaped, reviewer-ready); the pre-filled workbook (`report.xlsx`) was produced and verified but is not committed (see above).
