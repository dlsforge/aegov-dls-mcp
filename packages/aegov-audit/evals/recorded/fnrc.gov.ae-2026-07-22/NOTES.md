# Recorded run — fnrc.gov.ae (Fujairah Natural Resources Corporation), 2026-07-22

> Private report produced for the site's own team (the repo owner), committed here with the owner's standing approval as the Stage-2C recorded-run evidence (same arrangement as the 2026-07-12/20/21 runs). Community project — not affiliated with or endorsed by TDRA.

## What this run demonstrates vs the 2026-07-21 recording

The Stage 2C **zero-false-positive slice** expanded coverage from **53 to 61 of 125 items**. Every added check fires only on hard evidence:

- **3.40** — offline W3C-style validation of the raw page source (pinned `html-validate` 11.5.6, spec-conformance preset only; no calls to validator.w3.org).
- **3.42 (+3.15 partial)** — horizontal-overflow sweep at the design system's five responsive breakpoints (640/768/1024/1280/1536px, verified from the toolchain the DLS plugin compiles against).
- **3.60/3.61** — monolithic-CMS fingerprint from self-declared signals only (generator meta, core asset paths).
- **2.21** — icon libraries other than the guideline's approved **Phosphor** set (docs-sourced, retrieved 2026-07-22, marked for confirmation).
- **1.1/3.1** — the existing `dls-not-used` rule (zero `aegov-*` classes on the rendered page) now also evidences "design system implemented/installed"; non-use is decisive, the version half stays with the human reviewer.

Consciously skipped for false-positive risk: 2.11 (no machine-readable functional-colour contract in the package), 2.13/2.26/2.29/2.31 (element identification too ambiguous).

## Run conditions

- `aegov-audit https://fnrc.gov.ae --lighthouse --format xlsx --out …` — headless Chromium (Playwright 1.61.1 pinned), axe-core 4.12.1, Lighthouse 13.4.0 (both form factors, simulated throttling), html-validate 11.5.6, local machine (Windows x64), 2026-07-22. Exact conditions inside `report.json`/`report.md`.
- Crawl, parity, and `--entity-type` posture identical to 2026-07-21 (no parity leg — one-URL culture-cookie architecture; no ministry flag, so 2.12 is the only not-checked item).

## What the new checks found — and where they stayed silent

- **3.40:** 98 validation errors in the served source across 3 spec rules (mostly `element-permitted-content`/`element-permitted-parent`) — the browser repairs these while parsing, which is exactly why the raw source is validated, not the rendered DOM.
- **2.21:** Font Awesome 4.5.0 loaded from a CDN — direct fact, contrasted with the guideline's approved Phosphor library. (The 2026-07-20 blind review had independently noted duplicate Font Awesome versions; this is now machine-attached to its checklist item.)
- **1.1/3.1:** flagged via `dls-not-used` — the site ships zero `aegov-*` classes.
- **Correctly silent:** `stack-monolithic-cms` did NOT fire — the site's ASP.NET/IIS stack declares no generator meta and none of the hard signals matched, so Mizan says nothing rather than guessing (3.60/3.61 read "no automated findings", which is NOT a pass). `ix-breakpoint-overflow` also stayed quiet — the Bootstrap layout reflows at all five breakpoints, consistent with the 175%-zoom result.

## Headline results (local run conditions — NOT comparable to TDRA's environment)

- **36 of the 61 machine-checked checklist items carry findings** (1.1, 2.2, 2.3, 2.7–2.10, 2.21, 2.35, 2.42, 3.1, 3.4, 3.6, 3.8, 3.9, 3.12, 3.14, 3.29, 3.31–3.36, 3.38–3.40, 3.46, 3.48–3.51, 3.53, 3.54, 3.57, 3.64); **64 of 125 items need human review** (72 on 2026-07-21, 86 on 2026-07-20, 111 on 2026-07-12).
- 87 findings total: 1 critical, 20 serious, 58 moderate, 8 minor.
- Lighthouse mobile: performance 26, accessibility 83, best-practices 65, SEO 82; desktop: 26/77/65/82 — TDRA thresholds not met under local conditions (run-to-run Lighthouse variance applies).
- `report.xlsx` produced and verified, not committed (embeds TDRA's workbook — same contract as prior runs).
