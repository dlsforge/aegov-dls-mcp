# Recorded run — fnrc.gov.ae (Fujairah Natural Resources Corporation), 2026-07-21

> Private report produced for the site's own team (the repo owner), committed here with the owner's standing approval as the Stage-2B Tier C+D recorded-run evidence (STAGE2B-HANDOFF §3, same arrangement as the 2026-07-12 and 2026-07-20 runs). Community project — not affiliated with or endorsed by TDRA.

## What this run demonstrates vs the 2026-07-20 recording

Stage 2B Tiers C+D expanded the machine-checked TDRA checklist coverage from **39 to 53 of 125 items**:

- **Tier C — computed-style checks against the resolved rules-core tokens** (2.2/2.3 approved fonts + heading weights, 2.6 neutral background, 2.7 AEBLACK-800 text, 2.8 AEGOLD-600 actions, 2.9/2.10 contrast sweeps, 2.23 icon size, 2.12 ministries palette behind `--entity-type ministry`) and **interaction checks** (2.38 layout at 175% zoom, 3.13 keyboard reach, 3.14 focus indication; fail-soft — an aborted walk reads "not checked").
- **Tier D — bounded same-origin crawl** (home + up to 6 linked pages, robots.txt honoured, self-identifying User-Agent): 3.29 unique titles/descriptions, 3.25 Page Rating presence on service-looking pages (explicit heuristic), and 3.35 upgraded from home-only to every crawled page.
- The §4 stretch items (3.19–3.22, 2.40 header/footer conformance) are **deferred** — the docs-sourced block-markup path in rules-core does not exist yet, and no weaker heuristic was substituted.

## Run conditions

- `aegov-audit https://fnrc.gov.ae --lighthouse --format xlsx --out …` — headless Chromium (Playwright 1.61.1 pinned binary), axe-core 4.12.1, Lighthouse 13.4.0 (both form factors, simulated throttling), local machine (Windows x64), 2026-07-21. Exact conditions are inside `report.json`/`report.md`.
- The crawl covered **home + 6 subpages** (cap 6) under the politeness rules above; the site serves no robots.txt, so no Disallow rules applied.
- The site still client-redirects `/` → `/portal/home/index`; the navigation-settle handling from step 7 applies.
- No `--parity` leg, for the same reason as before: both languages are served at one URL via a server-side culture cookie (not URL-addressable). The architecture is itself flagged (`meta-alternate`).
- No `--entity-type` was passed (FNRC is not a ministry), so item 2.12 correctly reads "not checked" — the only not-checked item in this run.

## What the new engines found (all independently re-checkable from the report)

- **Typography & colour system (2.2, 2.3, 2.7, 2.8, 2.9, 2.10):** the dominant body font is "Droid Arabic Kufi Regular" (100% of sampled text) — not one of the DLS font tokens; h2 headings render at weight 400 vs the token's 800; the dominant text colour rgb(158, 151, 143) matches no DLS token (checklist asks AEBLACK-800); none of the 48 action elements use AEGOLD-600; footer text sits at 2.61:1 against its section background; multiple action elements fall below 4.5:1 — including carousel `slide-btn` controls whose text computes **white-on-white (1:1)**.
- **Focus indication (3.14):** 10 of 75 keyboard-focused elements show no visible focus indication (navbar brand/toggler/links among them). Keyboard *reach* (3.13) produced no finding — the full tab cycle visited every region — and the layout survived the 175% zoom check (2.38), so those items honestly read "no automated findings".
- **Crawl (3.29, 3.35):** two crawled pages share the identical title "نبذة عن المؤسسة"; all 6 crawled subpages lack alternate-hreflang links (extending the home-page `meta-alternate` finding site-wide). No crawled page classified as a service page, so 3.25 stayed quiet rather than guessing.
- Icon size (2.23) and neutral background (2.6) produced no findings on this site — rendered icons meet 24px and the page background is neutral; both are listed as machine-checked with "no automated findings", which is NOT a pass.

## About `report.xlsx` (not committed)

Same contract as 2026-07-20: the workbook copy pre-fills the **Reason column (F)** for all 125 items, never touches the **Validate column (E)**, never writes "Completed", and is **gitignored** because a filled copy embeds TDRA's own workbook, which this repo never redistributes. Structural verification is pinned by `test/xlsx.test.mjs`.

## Cross-check status

The 2026-07-20 recording was diffed against two independent blind expert reviews (see that run's NOTES). This recording extends the same site with the Tier C+D engines; the blind-review boundaries documented there still stand, and two of them are now closed by machine checks: per-page title uniqueness (3.29, then listed as "needs a multi-page crawl — planned Tier D") and keyboard focus-state coverage (3.14, then a human-review boundary). The remaining boundaries (deep-route soft-404s, semantic-structure judgment, Arabic wording quality, carousel behaviour) still apply. The Tier C/D findings above are heuristic-tier by design and are stated as review flags, not verdicts.

## Headline results (local run conditions — NOT comparable to TDRA's environment)

- **32 of the 53 machine-checked checklist items carry findings** (2.2, 2.3, 2.7–2.10, 2.35, 2.42, 3.4, 3.6, 3.8, 3.9, 3.12, 3.14, 3.29, 3.31–3.36, 3.38, 3.39, 3.46, 3.48–3.51, 3.53, 3.54, 3.57, 3.64); **72 of 125 items need human review** (down from 86 in the 2026-07-20 recording and 111 in 2026-07-12).
- 85 findings total: 1 critical, 20 serious, 57 moderate, 7 minor.
- Page weight remains far over the checklist budgets: **5.55 MB total vs the 4 MB budget** (3.54) and **1.02–1.40 MB excluding images vs 500 KB** (3.53) — transfer sizes of this local load.
- Lighthouse mobile: performance 27, accessibility 87, best-practices 65, SEO 82; desktop: 21/77/65/82. TDRA thresholds (A11y/Perf/SEO ≥ 90, BP ≥ 80, LCP ≤ 2.5 s, FCP ≤ 1.8 s) are **not met under local conditions**. (Lighthouse numbers vary run-to-run; desktop accessibility differs from the 07-20 recording for that reason.)
- The full findings are in `report.json` (machine) and `report.md` (TDRA-checklist-shaped, reviewer-ready); the pre-filled workbook (`report.xlsx`) was produced and verified but is not committed (see above).
