# Stage 2B Handoff — Mizan Coverage Expansion + TDRA Excel Output

> **Status: BUILT.** Tiers A+B + the xlsx writer shipped 2026-07-20 (commits `1c8c4e2`, `914fb51`, coverage 14 → 39). Tiers C+D landed 2026-07-21: coverage 53 of 125 (12 Tier C items incl. 2.12 behind `--entity-type ministry`, plus 3.25/3.29 from the Tier D crawl and the 3.35 all-pages upgrade). A **Stage 2C zero-false-positive slice** landed 2026-07-22: coverage is now **61 of 125** — 3.40 (offline html-validate on the raw source), 3.42+3.15 (breakpoint overflow sweep), 3.60/3.61 (monolithic-CMS fingerprint, hard signals only), 2.21 (icon library vs the guideline's Phosphor, docs-tier), 1.1/3.1 (mapped from `dls-not-used`). 2.11 was consciously skipped (no machine-readable functional-colour contract in the package) as were 2.13/2.26/2.29/2.31 (identification too ambiguous to meet the no-false-positive bar). The §4 stretch items are DEFERRED (see step 4). Remaining: publish `@dlsforge/aegov-audit@0.1.0` (step 7, Alam's credentials).
>
> Numbering note: the project's Stage 3 (`FUTURE-STAGES-NOTES.md`) is **Recognition & Adoption** — outreach, not code. This stage is new engineering work that sits between Stage 2 (Mizan v0.0.1, shipped) and Stage 3, so it is named **2B**. It exists to make the Stage-3 demo package dramatically stronger: "Mizan machine-checks 50+ of TDRA's 125 items and hands you back TDRA's own Excel workbook, pre-filled with evidence."

## 1. What we are building, in one paragraph

Expand Mizan's TDRA-checklist coverage from **14 of 125 items to ≥50 (conservative) / ~59 (with stretch items)** using purely deterministic checks — no LLM, stays MIT, stays in this repo — and add an **`--format xlsx` output** that fills a copy of TDRA's own assessment workbook (the file entities actually submit) with machine findings and evidence, leaving human-judgment rows clearly marked. The remaining items split into ~10–15 judgment items (Studio's lane, out of scope here) and ~35–40 process-history items no software can check (the xlsx output manages them as human-answer rows).

## 2. Why this matters

- The current honest note — "Mizan machine-checks 14 of 125" — is trustworthy but underwhelming as a pitch. The gap is not capability, it's unwritten rules: Stage 2 stopped at the direct-evidence subset of the engines built then.
- Evidence Mizan **already collects** (Lighthouse audits) is not attached to checklist items at all — free coverage sitting on the table.
- The xlsx output changes the deliverable from "a report about the checklist" to "the checklist itself, pre-filled" — the artifact an entity hands to a TDRA reviewer. No generic scanner does this.
- Tier C (token-aware computed-style checks) is the moat: only a tool with rules-core's resolved token model can check "is this AEGOLD-600."

## 3. Definition of done (the exit test — do not declare success without it)

1. Against the recorded fnrc.gov.ae capture (re-recorded this stage) and the seeded fixtures, Mizan attaches direct evidence to **≥50 distinct checklist items**, with zero false-positive findings on the `compliant` fixture.
2. `--format xlsx` produces a workbook that: opens cleanly in Excel; preserves TDRA's rows, ids, and question text for all 125 items; fills machine-checked rows with finding summaries or "No automated findings (checked: …)"; marks every other row "requires human answer"; and **never writes "Completed" or any pass verdict in any cell**.
3. The report's coverage note (auto-computed in `tdra.ts` — never hand-edit) reflects the new counts, and every new rule→item mapping is direct-evidence only, same bar as Stage 2.

## 4. Tech stack (verify all versions live at build time; pin them)

- Existing engines carry over: axe-core, Lighthouse, Playwright, the DLS engines, rules-core tokens.
- **exceljs** — read/write TDRA's workbook preserving formatting. Verify current version live; confirm it round-trips the actual cached workbook (`packages/aegov-audit/.tdra-cache/tdra_dls-assessmentcriteria-2023_version2_0.xlsx`) without mangling styles **before** building on it; if it mangles, evaluate alternatives from the actual file, not docs.
- **html-validate** (offline W3C-style validation, pinned) for item 3.40. No network calls to validator.w3.org at audit time.
- No new services, no LLM calls, no telemetry. Everything runs local.

## 5. Repository shape

No monorepo changes. New code lives in `packages/aegov-audit`:

- `src/engines/` — new rule modules (suggested: `assets.ts` for favicon/OG/meta wins, `media.ts` for srcset/WebP/lazy/video, `interaction.ts` for keyboard/focus/zoom, `crawl.ts` for multi-page checks). Follow existing engine structure/finding shape exactly.
- `src/report/xlsx.ts` — the workbook writer, consuming the same `ChecklistView` the md/json reports use.
- `RULE_TO_ITEMS` in `src/report/tdra.ts` grows with every new rule. Keep the curation comment's "direct evidence only" contract.

## 6. Build order (in sequence — smallest proof first)

**Step 0 — revalidate the checklist.** Re-fetch the TDRA workbook; confirm it is still v2.0. If TDRA has published a newer version, stop and re-extract before mapping anything (the reference JSON's trust note requires this).

**Step 1 — Tier A: map existing Lighthouse evidence (~7 new items, minimal code).**
Attach already-collected Lighthouse audits to items: 3.43 (render-blocking), 3.46 (unminified CSS/JS), 3.47 (cache policy), 3.50 (offscreen/lazy images — pair with a DOM `loading="lazy"` check), 3.53/3.54 (page-weight budgets, images excluded/included), 3.58 (third-party impact). **Verify each Lighthouse audit id against the installed version — do not map from memory.** Lighthouse-sourced findings must carry the run-conditions caveat the report already prints.

**Step 2 — Tier B: single-page DOM/HTTP rules (~19 new items).**
2.35 skip-to-content link · 2.42+3.38 designed error pages (fetch a guaranteed-404 URL; 403/500 are partial — say so in the finding) · 3.8 `aria-hidden` on decorative icons · 3.9 icon supporting text (visible or `sr-only`) · 3.23+3.49 `<picture>`/`srcset` · 3.30 favicon + size variants · 3.31 theme-color/apple meta · 3.36 Open Graph tags · 3.37 HTML5 semantic landmarks · 3.39 `rel="noopener"` on `target="_blank"` · 3.40 html-validate · 3.41 fonts served from Google Fonts vs self-hosted (flag only — report the fact, it's TDRA's rule to enforce) · 3.51 WebP-primary images · 3.52 video via YouTube/Vimeo embed vs self-hosted · 3.57 JS placement/defer · 3.59 cookie-banner heuristic (mark heuristic in the finding) · 3.64 sitemap.xml fetch.

**Step 3 — Tier C: rendered checks against rules-core tokens (~12 new items).**
2.2/2.3 approved font family + heading weights from computed styles · 2.6 neutral background palette · 2.7 AEBLACK-800 primary text · 2.8 AEGOLD-600 on action elements · 2.9/2.10 contrast sweeps beyond axe's defaults · 2.12 ministries-only palette (behind an `--entity-type ministry` flag; skip otherwise) · 2.23 rendered icon size ≥24px · 2.38 layout at 175% zoom (horizontal-overflow check) · 3.13 keyboard tab-walk reaches nav/main/footer actions · 3.14 focus-visible styling present on actionable elements. Compare against **resolved token values from rules-core** — never hard-code hex values in the engine.

**Step 4 — Tier D: small multi-page crawl (~2 new items + upgrades).**
Crawl a bounded page set (home + linked same-origin pages, capped, polite). 3.29 unique titles/descriptions · 3.35 upgraded from single-page to all-crawled-pages · 3.25 Page Rating block presence (partial: heuristic page classification; full classification is Studio's). **Stretch (may defer):** 3.19–3.22/2.40 header/footer conformance — gated on the docs-sourced block-markup path in rules-core, which does not exist yet. If deferred, say so here and move on; do not hand-wave a weaker check into these items.

> **DEFERRED (2026-07-21):** 3.19–3.22 and 2.40 are NOT in this stage. The docs-sourced block-markup path in rules-core still does not exist, so there is no trustworthy header/footer contract to check against — and per the rule above, no weaker heuristic was substituted. These five items remain human-review rows until that rules-core work lands.

**Step 5 — the Excel writer.**
`--format xlsx`: take TDRA's workbook (from `--xlsx-template <path>`, else the cached copy, else fresh download), write into a **copy**: per row, finding summaries + evidence for machine-checked items, "No automated findings (checked: …)" for clean machine-checked items, "requires human answer" markers elsewhere. Locate the answer/comment columns by reading the actual workbook at build time (the extract script knows the layout) — do not assume column letters. Warn loudly on version drift vs the reference JSON. **Never ship TDRA's workbook inside the npm package** — fetch or accept it; the cache stays gitignored.

**Step 6 — evals + re-record.**
New seeded fixtures per engine group with `expected.json`; the `compliant` fixture must stay finding-free (false-positive gate). Re-record fnrc.gov.ae under documented run conditions. Round-trip test the xlsx (write, re-parse, assert all 125 rows + no verdict words in machine rows). Update both READMEs' coverage claims from the computed numbers.

**Step 7 — publish.** `@dlsforge/aegov-audit@0.1.0` (minor bump — new features, no breaking CLI changes), following the Stage-2 publish runbook (mind the npm-12 `pack --json` gotcha). Tag, verify live.

## 7. Rules carried over (non-negotiable)

- **Direct evidence only** in `RULE_TO_ITEMS`; when a check is partial or heuristic, the finding text says so.
- **The honesty note stays.** "No automated findings" is never presented as a pass; the xlsx writer enforces the same (no "Completed", ever).
- **No LLM/judgment features here** — Arabic quality, alt-text meaningfulness, imagery review, page classification belong to Studio, consuming `report.json`.
- **Verify live, never from memory:** Lighthouse audit ids, exceljs behavior on the real workbook, the TDRA workbook version and column layout, html-validate rule ids.
- Pinned deps; commits under Alam's personal identity; MIT; "not affiliated with TDRA" stays in every README.

## 8. Compliance targets

Checklist v2.0 (published 2023-09-26, retrieved 2026-07-11) remains the mapped source; Step 0 revalidates it. Lighthouse thresholds unchanged from Stage 2 (§8 of STAGE2-HANDOFF.md), including the local-run-conditions caveat.

## 9. Guardrails and cautions

- **False positives are worse than gaps.** A wrong finding in a submitted workbook damages exactly the credibility Stage 3 needs. When a check can't be confident, emit nothing or an explicitly-heuristic note — never a confident-sounding guess.
- Crawling: same-origin only, small page cap, identify as Mizan in the user agent, respect robots.txt. Government sites may rate-limit; fail soft.
- Keyboard/zoom/focus checks are the flakiest — build them last within Tier C, gate behind stable selectors, and skip (with a "not checked" note) rather than flake.
- Some checklist items encode dated practice (e.g. 3.41 Google Fonts, 3.57 JS-at-end). Mizan reports conformance to **TDRA's written rule**, and may add a neutral informational note — it does not editorialize or silently "correct" the checklist.

## 10. Indicative effort

**40–70 effort-hours**: Tier A ~4h · Tier B ~15–20h · Tier C ~15–25h (browser interaction is finicky) · Tier D ~6h · xlsx writer ~8–12h · evals/re-record/publish ~8h.

## 11. Open decisions (Alam)

1. **Go/no-go and ordering** — Tiers A+B+xlsx alone reach ~47 items and the strongest demo artifact; Tier C/D could be a follow-up release if time is tight.
2. **`--entity-type` flag** (needed for 2.12 ministries palette): ship in this stage or defer?
3. **Stretch header/footer items (3.19–3.22, 2.40)**: in-scope, or wait for the docs-sourced blocks work in rules-core?
4. **Naming confirmed as Stage 2B?** (Keeps Stage 3 = Recognition & Adoption.)

## 12. First message to give Claude Code (when Alam says go)

> Read CLAUDE.md, STAGE2-HANDOFF.md, and STAGE2B-HANDOFF.md. Start Stage 2B at Step 0 (revalidate the TDRA workbook), then Step 1 (Tier A Lighthouse mapping) — verify every Lighthouse audit id against the installed version before mapping. Smallest proof first: one new mapped item end-to-end (engine → RULE_TO_ITEMS → report.md/json → test) before fanning out.
