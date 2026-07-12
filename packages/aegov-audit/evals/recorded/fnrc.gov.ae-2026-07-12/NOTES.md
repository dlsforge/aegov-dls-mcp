# Recorded run — fnrc.gov.ae (Fujairah Natural Resources Corporation), 2026-07-12

> Private report produced for the site's own team (the repo owner), committed here with the owner's explicit approval as the step-7 recorded-run evidence (STAGE2-HANDOFF §3). Community project — not affiliated with or endorsed by TDRA.

## Run conditions

- `aegov-audit https://fnrc.gov.ae --lighthouse --out …` — headless Chromium (Playwright 1.61.1 pinned binary), axe-core 4.12.1, Lighthouse 13.4.0 (both form factors, simulated throttling), local machine (Windows x64), 2026-07-12. Exact conditions are inside `report.json`/`report.md`.
- The site client-redirects `/` → `/portal/home/index` (and re-navigates once more ~2 s later). The CLI's navigation-settle handling (added because of this site) waits for a stable URL before any engine runs.

## Why there is no `--parity` leg

fnrc.gov.ae serves **both languages at the same URL**, switched by a server-side culture cookie (`/portal/Home/ChangeCurrentCulture/0|1` — works only as an in-page click, not as a directly fetchable URL). Language variants that are not URL-addressable cannot be loaded side-by-side, so the parity engine does not apply; this architecture is itself flagged by the report (`meta-alternate` — no hreflang possible) and was reviewed manually instead:

- A manual click-through of the language switch (recorded rendered-DOM snapshots, reviewed below) found the two language states **structurally equivalent** — identical element census (h1×1, h2×5, h3×33, nav×2, a×153, img×120, …) with fully translated visible copy. Arabic wording still needs **native-speaker review**; Mizan never asserts parity.

## Exit-test cross-check: Mizan vs three independent blind expert reviews

Three independent expert reviews (WCAG/accessibility, UAE-standards/DLS, technical-SEO) were run **blind** — from rendered-DOM snapshots only, without access to Mizan's report — then diffed against `report.json`.

### Verdict against §3

- **No fabricated failure:** every Mizan finding was independently confirmed by at least one blind review (image alts incl. the CMS placeholders, unnamed links, contrast, heading structure, wrong `lang`, missing `dir`, no canonical/hreflang, hard-coded inline styles, typeless buttons, no DLS usage, Lighthouse-visible performance weight).
- **No critical machine-checkable miss:** the blind reviews' critical items are all in the report — wrong document language (`meta-lang-mismatch`), missing RTL direction (`meta-dir`, `dls-arabic-rtl`), unnamed image-only links (axe `link-name`), missing/placeholder alt text (axe `image-alt`, `dls-img-alt`, `dls-img-alt-placeholder`), and the site not using the DLS at all (`dls-not-used`).
- Three engine rules and one report behavior were **added during this comparison** (the eval loop working as designed): `meta-lang-mismatch` (Arabic page declaring `lang="en"` — 82% Arabic script), `dls-img-alt-placeholder` (`alt="Alternate Text"` ×6, `alt="Image Placeholder"` ×16 live), `dls-not-used` (zero `aegov-*` classes), and per-rule sampling with an explicit rollup (79 raw `dls-img-alt` hits → 10 samples + "…and 67 more", the way an expert reports extent). Each is pinned by an eval fixture.

### Documented machine-check boundaries (expert findings Mizan intentionally does NOT claim)

These need human judgment or interaction and are covered by the report's "items needing human review" — listed here so the boundary is explicit, per §9:

1. **Keyboard operability of custom controls** — click-only `<span>`/`<img>` close buttons and rating icons (an effective keyboard trap), `tabindex="-1"` on static links, missing skip link. Static analysis cannot prove focus behavior; axe covers only fragments (e.g. `scrollable-region-focusable`).
2. **Auto-rotating carousels with no pause/stop/hide** (WCAG 2.2.2) — requires interaction/time observation.
3. **Hidden-content defects** — the popup search's unlabeled input/checkboxes are `display:none` at audit time; axe audits the rendered visible state.
4. **Language of parts** (WCAG 3.1.2) — English UI fragments ("Alert", "Previous/Next", theme names) inside Arabic content.
5. **Content quality judgments** — meaningless-but-unique alt text, wrong carousel dot labels ("4 of 3"), title quality, empty meta description/OG tags (SEO-tier, outside the TDRA checklist's machine-checked set), duplicated/dead third-party payloads (double jQuery, two Font Awesome versions).
6. **Arabic wording quality** — native-speaker review, always.

## Headline results (local run conditions — NOT comparable to TDRA's environment)

- Lighthouse mobile: performance 26, accessibility 87, best-practices 65, SEO 82; desktop: 14–15/77/65/82. TDRA thresholds (A11y/Perf/SEO ≥ 90, BP ≥ 80, LCP ≤ 2.5 s, FCP ≤ 1.8 s) are **not met under local conditions**.
- The full findings are in `report.json` (machine) and `report.md` (TDRA-checklist-shaped, reviewer-ready).
