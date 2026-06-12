# PROJECT CONTEXT — Read This First (v2)

> **Purpose:** Anchor document for the project knowledge base. Orients any future conversation in seconds. Detailed specs live in `STAGE1-HANDOFF.md` and `FUTURE-STAGES-NOTES.md`. Work tracking lives in Notion (Project Hub + Decision Log + Core+MCP task board). Update order on any change: **repo files first, then Notion**. Last updated: June 12, 2026 (v2 — supersedes v1; replace v1 in project knowledge).

## What this project is

**UAE Government Digital Service Accelerator** — an AI platform vision whose disciplined first delivery is AI tooling grounded in the official UAE Design System (AEGOV DLS): a rules core + MCP server + compliance auditor, with a hosted bilingual Studio as the possible Plan 2 centerpiece.

**Owner:** Alam — AI engineer/architect (senior). A second engineer (same stack, slightly junior) may join from the Studio phase. Claude acts as lead developer/architect; Alam owns testing, Arabic/RTL validation, decisions, relationships, accounts.

**Audience for recognition:** TDRA + UAE federal entities (Excellence Program), plus UAE AI awards / GITEX (Dec 7–11, 2026) / Dubai AI Festival (Oct 26–27, 2026), plus an internal-promotion case at Alam's employer.

## Plans status

- **Plan 1** (baseline): MCP server → CLI auditor → recognition.
- **Plan 2** (proposed after deep re-study): shared `aegov-rules-core` → MCP server (+`validate_snippet`) → auditor → **hosted bilingual AEGOV AI Studio** + Arabic/RTL parity engine + service-prototype agent; multi-venue recognition; BYO-API-key default with optional hosted budget (~$150–600/mo only for demos).
- **Decision: OPEN.** Core + MCP phase is identical in both plans and is **committed** — build it now, decide the later shape during this phase.

## Identity & repository structure (LOCKED)

- **GitHub org + npm scope:** `dlsforge` (verified available on npm; fallbacks: `mizanlabs`, `sanadlabs`). Never lead org identity with "aegov" — descriptive repo names only.
- **Public repo (MIT):** `aegov-dls-mcp` — rules core, MCP server, auditor. Packages: `@dlsforge/aegov-rules-core`, `@dlsforge/aegov-mcp`, later `@dlsforge/aegov-audit`.
- **Private repo:** `studio` — AEGOV AI Studio, Arabic/RTL parity engine, service-prototype agent. Proprietary until the path is decided.
- **README disclaimer (required):** "Community project. Not affiliated with or endorsed by TDRA."
- Naming architecture: neutral English org now; Arabic product names later (e.g., auditor → "Mizan").

## IP & endgame (decided June 12, 2026)

- Contract check done: **no employer claim on personal work.** Hygiene anyway: own machine, own time, own accounts; commit history under personal identity (timestamped authorship proof).
- Any future handover: **transfer-with-attribution, never re-upload.**
- **Four exit doors, all held open by the open-core split:** (1) employer adoption + promotion (primary); (2) sell — accredited Excellence Program agencies are natural buyers; (3) own business (DLS Forge); (4) **gift the open layer to TDRA as a national asset** — capstone scenario only, *after* recognition/adoption, via stewardship transfer into TDRA-ae org with founding authorship visible; never announced early; proprietary layer gains value if the core goes national.
- Sequencing discipline: build → ship → adoption → recognition → internal promotion → then play endgame cards. Endgame changes nothing about the current build.

## Current state & next step

- Notion workspace live: Project Hub, Decision Log, 22-task Core+MCP board (4 phases: Setup → Rules Core → MCP Tools → Integration & Ship).
- Alam's availability: strong Fri–Sat push; ~1 hr/day during kids' exam week (Sun–Wed, review tasks only); then 2–2.5 hrs/day. Core + MCP lands tested in **~3–4 weeks**; Alam's personal share ~35–60 focused hrs.
- **Next step:** Task #1 — create the `dlsforge` GitHub org + npm org, scaffold the repo in Claude Code, prove the MCP ping connection. `CLAUDE.md`, `STAGE1-HANDOFF.md`, `FUTURE-STAGES-NOTES.md`, and this file go in the repo root.

## Key decisions (do not relitigate without cause)

| Decision | Rationale |
|---|---|
| Toolkit first, platform later | Shipped 8 beats unshipped 9.5; DLS-depth is the moat, breadth is copyable |
| Core + MCP committed regardless of Plan 1 vs 2 | Identical in both plans; no reason to wait |
| Open-core split (MIT wedge / proprietary Studio layer) | MIT is irrevocable; open layer wins recognition, closed layer preserves sale/business options |
| `dlsforge` identity, never "aegov"-led | Avoid implying official TDRA status; trademark-safe; business-grade |
| No public scoreboard of government sites | Politically adversarial toward target adopters; private scoring only |
| No chatbot | UAsk DLS exists; differentiate on codegen, IDE/CI integration, auditing |
| BYO-API-key default for any LLM features | Near-zero cost; hosted budget only for award demos |

## Non-negotiables baked into the build

WCAG 2.2 AA · mandatory UAE Pass login · Emirates ID format 784-NNNN-NNNNNNN-N · Arabic/RTL first-class · DLS tokens only · official components over hand-rolled · stay out of TDRA's announced roadmap lanes (dark mode, Steps→Progress, Alerts→Callouts, nav dropdowns, new Card variations, Figma slots).

## Standing cautions

- Verify versions/thresholds live at build time (DLS v3.x, MCP SDK, TDRA criteria — all move). Parse the actual assessment XLSX before claiming TDRA alignment.
- Watch the TDRA-ae GitHub org; if TDRA ships its own MCP server, pivot to best auditor/linter on top.
- Arabic quality: automated checks flag, a native speaker confirms.
- Ship before someone else: the window is months, not years. The flag is planted at first public npm/GitHub publish.
