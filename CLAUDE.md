# CLAUDE.md — aegov-dls-mcp

> Instructions for Claude Code working in this repository. Read `STAGE1-HANDOFF.md` for the full build brief before writing code. `PROJECT-CONTEXT-v2.md` holds the project's strategy and decisions; `FUTURE-STAGES-NOTES.md` holds what comes after this repo's scope.

## What this repo is

The **public, MIT-licensed wedge** of the UAE Government Digital Service Accelerator:
1. `@dlsforge/aegov-rules-core` — machine-readable model of the UAE Design System (AEGOV DLS v3.x): component/block/pattern schemas, resolved design tokens, UAE-specific validators.
2. `@dlsforge/aegov-mcp` — MCP server exposing the core to AI coding assistants, including `validate_snippet`.
3. (Later) `@dlsforge/aegov-audit` — compliance auditor consuming the same core.

The proprietary layer (AEGOV AI Studio, Arabic/RTL parity engine, service-prototype agent) lives in a **separate private repo** (`studio`). Do not add Studio code, hosted-app code, or LLM-calling features here.

## Hard rules

- **Verify live, never from memory:** the installed `@aegov/design-system` version, its file structure, the MCP SDK API, and TDRA thresholds. If docs and package disagree, the installed package wins; flag the discrepancy.
- **Pin dependencies.** Bump deliberately, never silently.
- **Tokens only:** generated/scaffolded markup must use DLS tokens and official component classes — never arbitrary values, never hand-rolled equivalents of existing components.
- **Non-negotiables in all output:** WCAG 2.2 AA; UAE Pass for any login; Emirates ID format `784-NNNN-NNNNNNN-N` with masking + pattern validation; Arabic/RTL first-class (correct `dir`, bilingual-ready structure); DMY dates.
- **Arabic content:** generate it, but mark it for native-speaker review. Never silently "improve" Arabic text.
- **License & identity:** MIT. README must include: "Community project. Not affiliated with or endorsed by TDRA." Never present this as official TDRA tooling.
- **Commit hygiene:** commits under Alam's personal identity only. No company accounts, machines, or infrastructure.

## Build order (from STAGE1-HANDOFF.md — do not skip ahead)

1. Scaffold Node + TypeScript + MCP SDK; single `ping` tool; **prove an assistant connects before anything else.**
2. Install and inspect `@aegov/design-system`; confirm the real inventory (expected: ~28 components, 9 blocks, 6 patterns — verify).
3. Parse → `rules-core` (schemas, tokens, validators). This is the foundation every later product trusts; correctness over speed.
4. MCP tools: `listComponents`, `getComponent`, `getTokens`, `scaffoldUaePass`, `scaffoldEmiratesId`, `validate_snippet`.
5. Eval suite: 10 common government screens in `/evals`; iterate the catalogue and tool descriptions (never hand-edit outputs) until they pass reliably.
6. README + publish: npm under `@dlsforge`, GitHub under the `dlsforge` org, list on MCP registries.

## Definition of done (exit test)

Across the 10 eval screens, a connected AI assistant reliably emits valid, on-standard AEGOV DLS components — correct classes, correct structure, RTL-aware, bilingual-ready — **without hand-correction.**

## Working model

Claude Code does the heavy construction. Alam reviews the parsed core against the live design system, runs the integration evals, validates Arabic/RTL, owns publishing credentials and all final decisions. Task tracking lives in Notion; this repo is the single source of technical truth — when they disagree, the repo wins, then update Notion.
