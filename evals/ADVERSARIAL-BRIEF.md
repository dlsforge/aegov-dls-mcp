# Adversarial test brief — `@dlsforge/aegov-mcp`

> For an independent agent tasked with trying to break this project's central claim.
> Read this, then attack. Do not trust the numbers below — verify them.

## What the project is

An MIT-licensed **MCP server** that exposes a machine-readable model of the **UAE
Government Design System (AEGOV DLS v3.x)** to AI coding assistants. Goal: when a
connected assistant is asked to build a UAE government screen, the MCP tools should
carry enough of the standard that the assistant emits valid, on-standard AEGOV DLS
markup **without hand-correction**.

- Repo: `aegov-dls-mcp` (branch `main`). Server entry: `dist/index.js` (`npm run build`).
- Pinned source of truth: `@aegov/design-system@3.0.7` (a Tailwind v4 plugin; 27
  component class-roots). Components/tokens are package-sourced (authoritative);
  blocks/patterns are docs-sourced (`designsystem.gov.ae`) and carry a
  `needs-revalidation` trust flag.
- **7 MCP tools:** `ping`, `listComponents`, `getComponent`, `getTokens`,
  `scaffoldUaePass`, `scaffoldEmiratesId`, `validate_snippet`.

## The success criteria (what "done" claims)

1. **Exit test:** across 10 government-screen specs in `evals/screens/*.json`, a
   connected assistant reliably produces passing outputs. Judge: `npm run evals` —
   boots the real server over stdio, runs each `evals/outputs/<id>.html` through
   `validate_snippet` (any error fails), then applies per-spec structural checks
   (required class-roots, required/forbidden patterns, document lang, RTL).
   **Current claim: 10/10 pass.**
2. **Generation discipline** (`evals/README.md`): outputs are produced by
   MCP-connected assistants from the spec's `prompt` **only** — generators never see
   the `checks`; outputs are **never hand-edited** to pass; failures are fixed
   upstream (catalogue / tool descriptions / scaffolders), then regenerated.
3. **Non-negotiables in all output:** WCAG 2.2 AA; UAE Pass for any login; Emirates ID
   format `784-NNNN-NNNNNNN-N` with masking + pattern validation; Arabic/RTL
   first-class (correct `dir`, bilingual-ready); DMY dates; generated Arabic marked
   for native-speaker review.
4. **Token fidelity:** generated markup uses only real DLS tokens and official
   component classes shipping in the pinned package — never arbitrary values, never
   classes that exist only in docs but don't ship in 3.0.7.

## Where to attack (highest-value adversarial angles)

1. **Eval integrity vs. reality.** Does a "PASS" actually mean standard-compliant, or
   just that it satisfies the judge's regexes? Look for outputs that pass the checks
   but are structurally wrong, inaccessible, or visually broken. The checks are
   pattern/class-root based — probe for gaming.
2. **`validate_snippet` soundness** (`src/tools/validateSnippet.ts`) — the load-bearing
   tool. Two bug classes already found here (heuristics over/under-matching):
   - **False negatives:** feed genuinely non-compliant markup (unshipped classes,
     unmasked Emirates ID, missing `alt`, Arabic without `dir=rtl`, wrong EID pattern)
     and see what it lets through. The EID detector keys on name/id/placeholder
     containing `784`/`emirates-id`/`eid` — try an EID field that dodges all three.
   - **False positives:** feed valid markup and see what it wrongly flags. (Prior bug:
     a search box valued "Emirates ID renewal" was flagged as an EID field — fixed by
     ignoring the `value` attribute; check the fix holds and find the next one.)
3. **Drift classes.** Docs examples include classes that don't ship in 3.0.7 (e.g.
   `aegov-pagination-larger/smaller`, `aegov-newslette*`, hero `aegov-slider-next/prev`).
   The tools now emit a `driftWarning`. Verify the drift list is complete and that
   `validate_snippet` rejects every non-shipping `aegov-*` class. Cross-check against
   the compiled CSS in `node_modules/@aegov/design-system`.
4. **Non-negotiable enforcement.** Craft snippets / prompt the assistant for: a login
   screen without UAE Pass; a full unmasked Emirates ID (`784-1234-1234567-1`) on-page;
   an Arabic form without RTL; MDY dates. The system should catch all of these — find
   one it doesn't.
5. **Scaffolder correctness.** `scaffoldUaePass` (button rules: appearances, min size
   140×30pt, sign-in/sign-up never on same page, "Continue with UAE PASS" disclosure)
   and `scaffoldEmiratesId` (pattern + masking). Try to get them to emit output that
   violates their own documented rules. Note: their **Arabic strings are
   machine-generated** and only flagged for review — probe whether that flagging is
   reliably present.
6. **Provenance honesty.** Docs-tier records should carry source URL + retrieved-on
   date + trust flag; package-tier should be introspected from the pinned version.
   Look for docs-sourced claims presented as authoritative, or version drift between
   the catalogue and the installed package.

## Commands the tester will need

- `npm run build` → compile server to `dist/`
- `npm run smoke` → 19 protocol/tool checks
- `npm run evals` → the 10-screen judge (pass/fail per screen)
- `npm run validate` → build-failing lint over the shipped catalogue artifacts
- MCP tools are reachable as `mcp__aegov-dls__*` once the server is connected
  (registered in `.mcp.json`, enabled in `.claude/settings.local.json`; run
  `npm run build` first so `dist/` exists).

## The single most important question for the tester

**Is 10/10 a real measure of standard-compliance, or has the standard leaked into the
tests/tools?** Specifically: (a) can a compliant-looking output pass while being wrong,
and (b) can `validate_snippet` be made to pass bad markup or fail good markup? Those two
are where the project's central claim lives or dies.

## Rules of engagement (so findings are actionable)

- Attack the **tools and catalogue**, not the individual output files. A hand-edited
  output that fails proves nothing; a *tool* that certifies bad markup as valid is a
  real finding. When you find a bad output, trace it to the upstream tool/catalogue
  gap that let it through.
- Distinguish **package-tier** (must be exactly right vs. 3.0.7) from **docs-tier**
  (best-effort, flagged) — hold each to its own bar.
- For every claimed defect, give a minimal reproducer (the snippet + the tool call +
  expected vs. actual) so it can be fixed upstream and re-evaluated with `npm run evals`.
