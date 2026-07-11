# Stage 2 Handoff — Mizan, the AEGOV DLS Compliance Auditor

> **Purpose of this file.** Build brief for Stage 2 of the UAE Government Digital Service Accelerator: the compliance & accessibility auditor, product name **Mizan** (ميزان — *scale/balance*), package `@dlsforge/aegov-audit`. It lives at the repo root beside `STAGE1-HANDOFF.md`. Read this top to bottom before writing code. `PROJECT-CONTEXT-v2.md` holds the strategy; `FUTURE-STAGES-NOTES.md §Stage 2` is the source these details expand on; `CLAUDE.md` holds the hard rules that still apply unchanged.
>
> **Status: GO (Alam, 2026-07-12).** Both §11 decisions are settled: **(1) full npm-workspaces monorepo**, **(2) the `@dlsforge/aegov-mcp@0.1.1` republish is DEFERRED** — the version is bumped locally when it starts importing the shared core, but nothing ships to npm until Alam decides; the live `0.1.0` keeps serving existing users. Every TDRA threshold below remains **provisional and must be re-verified live** (§8).

---

## 1. What we are building, in one paragraph

**Mizan** inspects a finished or in-progress UAE government website and reports, in seconds, whether it meets the country's mandatory standards — turning a slow, expert-only manual review into an instant, repeatable check. It runs three engines over a rendered page: **axe-core** (WCAG accessibility), **Lighthouse** (the same performance / accessibility / SEO / best-practices scores TDRA uses), and a **custom DLS rules engine** that generic tools cannot do — the differentiator. The DLS-specific checks reuse the exact catalogue and rule set that Stage 1 already built and shipped; Mizan does not re-derive the standard, it consumes it. Output is a machine-readable report plus a human report shaped to mirror the official TDRA assessment checklist, so an entity can hand it straight to a reviewer.

## 2. Why this matters (context you should not lose)

- Stage 1 (the MCP server, `@dlsforge/aegov-mcp@0.1.0`) is **published and live**. It helps assistants *generate* correct government UI. Mizan is the other direction: it *verifies* an existing site. Same standard, opposite flow.
- The auditor is **the strategic hedge.** Standing caution from `PROJECT-CONTEXT-v2.md`: watch the `TDRA-ae` GitHub org — *if TDRA ships its own MCP server, pivot to being the best auditor/linter on top.* Mizan is that position. It stays valuable even if the generation layer gets commoditised.
- **No public scoreboard.** Scoring government sites publicly is politically adversarial toward the exact entities we want as adopters. Mizan produces **private** reports for the site's own team. This is a locked decision — do not build league tables, public rankings, or a "name and shame" mode.
- **Keep a human in the loop**, especially on Arabic. Automated checks *flag*; a native speaker *confirms*. Never let Mizan assert Arabic parity as settled fact.

## 3. Definition of done (the exit test — do not declare success without it)

> Run against a **real UAE government entity website**, Mizan's report **matches what a manual expert review would find** and **maps cleanly onto the official TDRA assessment checklist** — no critical miss, no fabricated failure. A small eval set of fixture sites (one compliant, several with seeded, known defects) proves each check catches what it should and stays quiet when it should, so success is measurable, not opinion.

Keep an `evals/` folder (as Stage 1 did) with fixture sites + expected findings, plus at least one recorded run against a real government page with the run conditions documented.

## 4. Tech stack (all free / open source, all versions verified live at build time)

- **Node.js + TypeScript** — same toolchain as Stage 1.
- **axe-core** — accessibility engine; foundation for WCAG checks.
- **Lighthouse** — performance / accessibility / SEO / best-practices scores (the measures TDRA uses).
- **Playwright** — loads pages in a real browser, exposes the **rendered DOM and computed styles**, and can load both the English and Arabic/RTL variants for parity checks. This is the capability Stage 1's `validate_snippet` never had — it saw only source strings.
- **`@dlsforge/aegov-rules-core`** — the shared catalogue + DLS rule engine extracted from Stage 1 (§6, step 0). The single most important dependency; **import it, never duplicate it.**
- **GitHub Actions** — free CI so audits run on every change; ship a reusable action wrapper.
- **Pin every dependency** exactly (no `^`/`~`), matching Stage 1's discipline. axe-core, Lighthouse, and Playwright all move fast — pin and bump deliberately.

## 5. Repository shape — the monorepo conversion

`PROJECT-CONTEXT-v2.md` (LOCKED) says the one public MIT repo `aegov-dls-mcp` holds **all three** packages: `@dlsforge/aegov-rules-core`, `@dlsforge/aegov-mcp`, and `@dlsforge/aegov-audit`. Today the repo is a single package published from the root. Stage 2 converts it to an **npm-workspaces monorepo**:

```
aegov-dls-mcp/                     # repo name stays (don't rename a published repo lightly)
├─ package.json                    # workspaces root: { "workspaces": ["packages/*"] }
├─ packages/
│  ├─ aegov-rules-core/            # @dlsforge/aegov-rules-core  (NEW — extracted from Stage 1)
│  │  ├─ src/                      #   schema (types.ts), loader, and the DLS rule engine
│  │  ├─ catalog/                  #   catalog.json + uaepass.json move here (the data)
│  │  ├─ inventory/                #   components.json moves with its generating script
│  │  ├─ scripts/                  #   ALL catalogue generators: extract-inventory, fetch-docs,
│  │  │                            #   extract-docs, build-catalog, validate-catalog,
│  │  │                            #   fetch-uaepass, extract-uaepass, build-uaepass
│  │  ├─ test/                     #   catalogue-fidelity + rule-engine soundness suites
│  │  └─ package.json
│  ├─ aegov-mcp/                   # @dlsforge/aegov-mcp  (MOVED from repo root)
│  │  ├─ src/ …                    #   now imports @dlsforge/aegov-rules-core
│  │  ├─ scripts/                  #   run-evals.mjs + smoke-test.mjs stay with the server they exercise
│  │  ├─ test/                     #   MCP-protocol / tarball / publish-hygiene suites + STAGE1-CHECKLIST.md
│  │  └─ evals/                    #   the 10 eval screens drive the MCP tools — they stay with the server
│  └─ aegov-audit/                 # @dlsforge/aegov-audit — Mizan  (NEW)
│     ├─ src/
│     └─ package.json
└─ STAGE1-HANDOFF.md, STAGE2-HANDOFF.md, PROJECT-CONTEXT-v2.md, FUTURE-STAGES-NOTES.md, CLAUDE.md
```

**Migration must not regress Stage 1.** After the move, the full Stage 1 gate has to stay green from the new locations: `npm test` (84/84 — the split will spread these across two workspace suites; the gate is the *total* staying 84, not one suite holding them all), `npm run evals` (10/10), `npm run smoke` (19/19), `npm run validate`. Only then republish: `@dlsforge/aegov-rules-core@0.1.0` (new) and `@dlsforge/aegov-mcp@0.1.1` (the version that imports the shared core). The live `0.1.0` server keeps working for existing users; `0.1.1` is the first shared-core release.

## 6. Build order (do these in sequence — mirror Stage 1's "prove the smallest thing first")

> **Build log (2026-07-12):** step **0 DONE** (d6a4d91 — monorepo + rules-core extracted, all 84 Stage-1 tests preserved + 17 new = 101/101, evals 10/10, smoke 19/19, validate OK, T2 closed). Step **1 DONE** (f087601 — aegov-audit renders u.ae/en, u.ae/ar with dir=rtl, designsystem.gov.ae). Step **2 DONE** (47c63a2 — axe-core 4.12.1, normalized AuditFinding shape, seeded fixture 7/7). Step **3 DONE** (04a2edb — Lighthouse 13.4.0, both form factors, run conditions documented, NO thresholds asserted; note: lighthouse needs node ≥22.19, aegov-audit engines bumped accordingly). Step **4 DONE** — (a) shared rules-core checks over the rendered DOM (caught the live `aegov-newslette` docs typo on designsystem.gov.ae); (b) **token fidelity (T4)**: inline hard-coded design values on aegov-* elements (design properties only — JS-written positioning and zero-px excluded after real-site false positives) + computed colors vs the 173 oklch tokens (browser-converted, exact) as review flags; (c) **structure (T5)**: check-item/modal/accordion invariants read off the docs examples, docs-tier confidence with source URLs; (d) **UAE Pass**: login surface (password input / login control) with no UAE Pass signal → serious heuristic flag; (e) **Arabic/RTL parity** via `--parity [url]` (explicit or hreflang-discovered): dir=rtl on the Arabic variant, lang tagging, count-drift beyond tolerance, aegov components missing in one variant — every parity finding is a human-review flag, never an assertion. 25/25 audit tests across 4 seeded fixtures; real parity run u.ae/en↔/ar flagged both variants missing `<html lang>`. **Next: steps 5–8** (report aggregation mirroring the TDRA checklist — verify thresholds against the real assessment doc first, GitHub Action, fixture evals + recorded real run, publish).

**0. Extract `@dlsforge/aegov-rules-core` and convert to the workspaces monorepo.** This is the cross-stage trigger Stage 1 deliberately deferred (packaging decision: "do NOT split out rules-core until the auditor begins — that's the extraction trigger"). Three things move into the core and become a clean, tested public API:
   - **The catalogue data + schema + loader:** `catalog/*.json`, `src/catalog/types.ts`, `src/catalog/load.ts`, and the generating `scripts/`.
   - **The DLS rule engine:** *every* check currently inline in `src/tools/validateSnippet.ts` — the file is the source of truth; the inventory at extraction time is: class identity vs the pinned package (with the did-you-mean suggestions, known limit T1), the docs-tier class-evidence check (non-aegov classes verified against the full docs-example corpus — note its build-time dependency on the whole catalogue), drift-class rejection, Emirates ID format/masking/pattern **including the `<label for>` / `aria-labelledby` resolution machinery it depends on** (hardened by the N2–N4 adversarial fixes), `img` alt, `<button>` without explicit `type`, Arabic-without-RTL, and DMY dates. All of it lifted into pure, unit-tested functions over a **normalized input** so both callers reuse them: `validate_snippet` (source strings, as now) and Mizan (rendered DOM) — and every check moves *with its adversarial regression tests*. Fold in the T2 consistency note from the Stage 1 checklist while the code is open: apply the F4 unquoted-attribute fix to `driftClassesIn` in `shared.ts`, which still matches only quoted `class` attributes.
   - Prove no regression (§5), then publish core + republish mcp.

**1. Scaffold `aegov-audit` and prove it can load a real page.** CLI skeleton `aegov-audit <url|path>` that opens the target in Playwright and prints "loaded, N nodes". **Do not move past this until it renders a real government page**, exactly as Stage 1 didn't move past `ping`.

**2. Wire axe-core → WCAG findings.** Run axe against the rendered page; normalize its violations into the report's finding shape. Verify against a page with known accessibility defects (seed a fixture).

**3. Wire Lighthouse → the four scores.** Produce Accessibility / Performance / SEO / Best-Practices under **documented run conditions** (see §8 — location and throttling matter). Re-verify the current TDRA thresholds against the real assessment file *before* hard-coding any number.

**4. Build the custom DLS rules engine on the rendered DOM (the differentiating value).** Reuse `aegov-rules-core`, now with computed styles available:
   - **Token fidelity** — computed colours/spacing/type resolve to DLS token values, not arbitrary hex/px. *This completes Stage 1 known-limit **T4**, which `validate_snippet` could not do without a rendered page.*
   - **Structural correctness** — official components in valid nesting (e.g. `aegov-check-item` inside a form control; a modal with its dialog role). *This completes Stage 1 known-limit **T5**.*
   - **Mandatory UAE Pass** login present wherever a login exists.
   - **Emirates ID** handling — format `784-NNNN-NNNNNNN-N`, masking, pattern validation (reuse the high-stakes Stage 1 rules).
   - **Arabic / RTL parity** — both language versions present and structurally equivalent; Playwright loads both and diffs structure. Flag, don't assert (human confirms).
   - **Official components over hand-rolled** equivalents.

**5. Report aggregation.** Merge axe + Lighthouse + DLS findings into (a) machine JSON and (b) a human report **shaped to mirror the official TDRA assessment checklist**, each finding carrying severity, the rule, its provenance, and the fix. Findings reuse Stage 1's confidence tiers (`package | docs | heuristic`): a check grounded in a docs-tier record — blocks and patterns are docs-only, `needs-revalidation` — must say so in the finding; best-effort evidence, never presented as package-tier certainty. Include the exact run conditions in the report.

**6. GitHub Action wrapper.** A reusable action so an entity's repo audits itself on every change; fail the build on critical findings, warn on the rest.

**7. Run the evals (the exit test, §3).** Fixture sites + expected findings; iterate the rules engine — never hand-edit a report — until it matches a manual review. Record one real-government-site run.

**8. README + publish `@dlsforge/aegov-audit` (Mizan).** Install/usage for CLI + CI; the required TDRA disclaimer; documented Lighthouse run conditions. Publish MIT under `@dlsforge`, using the token-based publish flow proven in Stage 1 (2FA-or-token; `npm.cmd` on Windows).

## 7. The rules the auditor enforces (same non-negotiables, now verified not just promoted)

Identical to Stage 1's standard — Mizan checks what the MCP server generates:

- **WCAG 2.2 Level AA** (report against 2.1 too — the legal baseline).
- **UAE Pass** mandatory on any login.
- **Emirates ID** format + masking + pattern validation.
- **Arabic / RTL first-class** — parity between language versions.
- **DLS tokens only** — no arbitrary hard-coded values.
- **Official components/blocks/patterns** over hand-rolled equivalents *(block/pattern rules rest on docs-tier records — findings from them carry docs-tier confidence, never package-tier certainty; see step 5)*.
- **DMY dates.**

Consistency rule: Mizan and the MCP server must enforce the *same* rules from the *same* core. If a rule changes, it changes once in `aegov-rules-core` and both tools follow.

## 8. Compliance targets & the TDRA thresholds (RE-VERIFY — do not trust these numbers)

- **WCAG 2.2 AA**, reported against 2.1 as well.
- **TDRA assessment criteria**, provisionally including Lighthouse **Accessibility / Performance / SEO ≥ 90, Best Practices ≥ 80**, with load-time targets, on **both desktop and mobile**. **These figures move — parse the actual TDRA assessment XLSX/document at build time before claiming alignment** (`PROJECT-CONTEXT-v2.md` standing caution). Treat anything here written from memory as provisional.
- **Run conditions matter.** Lighthouse scores depend on run location, network throttling, and device emulation. Fix and **document the exact conditions in every report**, or the numbers are not comparable to TDRA's.
- Shape the report to the **official assessment checklist** structure so it's reviewer-ready.

## 9. Guardrails and cautions

- **No public scoreboard / no ranking of government sites** — private reports only (locked, §2).
- **Stay out of TDRA's announced roadmap lanes** (`PROJECT-CONTEXT-v2.md`): dark mode, Steps→Progress, Alerts→Callouts, nav dropdowns, new Card variations, Figma slots. Don't build checks that assume a lane TDRA is about to change.
- **Automated WCAG coverage is partial.** axe-core machine-checks only a subset of WCAG 2.2 AA success criteria; many require human judgement. Every report must state which criteria were machine-checked and which need manual review — a clean automated run is **not** 2.2 AA compliance, and presenting it as such would break the exit test's "no critical miss" clause.
- **Human-in-the-loop for Arabic parity** — automated flag, native-speaker confirm. Never silently "improve" Arabic.
- **Pin dependencies**; axe-core / Lighthouse / Playwright move fast — bump deliberately, re-run evals on every bump.
- **Verify live**: DLS version, MCP core API, and every TDRA number. Installed package + live assessment doc win over memory.
- **License & identity**: MIT; README carries "Community project. Not affiliated with or endorsed by TDRA."; commits under Alam's personal identity only.
- **Watch `TDRA-ae`**: if TDRA ships official tooling, reposition Mizan as the best auditor on top rather than competing head-on.

## 10. Indicative effort

Roughly **80–140 effort-hours** — larger than Stage 1 because it integrates several finicky engines (each with its own run-condition quirks) and adds the custom rules. Two-to-four weeks of active lead-developer-plus-owner collaboration; longer part-time. Step 0 (the extraction) is real work in its own right — budget for it and its regression gate before any auditor code.

## 11. Open decisions — SETTLED (Alam, 2026-07-12)

1. **Monorepo conversion vs. lighter split → full npm workspaces.** Three packages, one repo, per §5.
2. **Republish cadence for `@dlsforge/aegov-mcp` → DEFERRED.** The workspace bumps to `0.1.1` locally when it imports the shared core, but is NOT published until Alam decides. Consequence: until `@dlsforge/aegov-rules-core` is published, the clean-install-from-tarball test (G2) must install both tarballs (rules-core first, then mcp) instead of resolving from the registry — restore the single-tarball flow when the core is published.

Secondary (can decide during build): exact eval fixture set; whether the GitHub Action ships in the same package or its own; how much of the report to render as HTML vs. Markdown.

## 12. First message to give Claude Code (when Alam says go)

> "Read `STAGE2-HANDOFF.md`. Start with build step 0: convert the repo to an npm-workspaces monorepo and extract `@dlsforge/aegov-rules-core` — the catalogue data + schema + loader + generating scripts, and the DLS rule engine currently inline in `validateSnippet.ts`, lifted into pure tested functions the MCP server and the auditor both import. Prove the full Stage 1 gate still passes from the new layout (npm test 84/84, evals 10/10, smoke 19/19, validate OK) before writing any auditor code. Do not move past step 0 until Stage 1 is green from the monorepo."
