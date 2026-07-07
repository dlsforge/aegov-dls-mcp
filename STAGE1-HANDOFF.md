# Stage 1 Handoff — AEGOV DLS MCP Server

> **Purpose of this file.** This is the build brief for Stage 1 of the UAE Design System AI Toolkit. It is written to live at the root of the project repository so that Claude Code (or any AI coding assistant) can read it and start building with the full context already in hand. Read this top to bottom before writing code.

---

## 1. What we are building, in one paragraph

An **MCP (Model Context Protocol) server** that exposes the official **UAE Design System** (the AEGOV DLS, package `@aegov/design-system`, version 3.x, MIT-licensed, TailwindCSS 4-based) to AI coding assistants such as Cursor, Claude Code, and GitHub Copilot. When a government developer asks their assistant to build UI, the assistant should produce **correct, on-standard UAE government components** — including the UAE-specific patterns (Emirates ID input, mandatory UAE Pass login, Arabic / right-to-left defaults) — instead of generic web code. The server never invents design rules; it serves them from a structured catalogue parsed from the official source.

## 2. Why this matters (context you should not lose)

- The design system is **mandatory for UAE federal government websites** and is the single source of truth for components, tokens, Arabic/RTL behaviour, and accessibility.
- TDRA (the regulator) has **publicly invited** exactly this kind of tool — its own guidance says to "ground your AI tools in the UAE Design System."
- **No AEGOV-specific MCP server exists yet.** This is greenfield. Build it cleanly and openly.
- Keep a **human in the loop** (a UAE AI Charter principle). The server assists; it does not make final calls on quality, especially Arabic correctness.

## 3. Definition of done (the exit test — do not declare success without it)

> Across roughly **ten common government screens** (e.g. a service landing page, a multi-step application form, a login screen, a contact page, a card grid of services, a data table, an alert/notification, a hero, a footer, and an Emirates-ID entry step), an AI assistant connected to this server **reliably emits valid, on-standard AEGOV DLS components** — correct class names, correct structure, RTL-aware, bilingual-ready — **without the developer hand-correcting the output.**

Keep a small `/evals` folder with these ten prompts and the expected component output so success is measurable, not a matter of opinion.

## 4. Tech stack (all free / open source)

- **Node.js + TypeScript** — runtime and language. TypeScript is required: the catalogue must be strongly typed so the tools return reliable, well-shaped data.
- **Official MCP SDK** (`@modelcontextprotocol/sdk`) — the standard way to expose tools and resources to AI assistants. Use the current stable version; check its docs at build time rather than relying on memory, as the SDK evolves.
- **The design system itself** — `@aegov/design-system` (and, if useful, the React port `@aegov/design-system-react`) pulled from npm/GitHub as the source to parse.
- **A small parsing layer** — custom code that reads the package's CSS/tokens and the documented component markup into a structured JSON catalogue.
- **npm + GitHub** — for open-source distribution and version control. Publishing openly is part of the credibility strategy, not an afterthought.

## 5. Recommended repository structure

```
aegov-dls-mcp/
├─ README.md                  # what it is, how to install in Cursor/Claude Code/Copilot
├─ STAGE1-HANDOFF.md          # this file
├─ FUTURE-STAGES-NOTES.md     # reference notes for Stages 2 & 3
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ index.ts                # MCP server entry point; registers tools & resources
│  ├─ catalog/
│  │  ├─ parse.ts             # reads @aegov/design-system into structured data
│  │  ├─ catalog.json         # generated: components, blocks, patterns, tokens
│  │  └─ types.ts             # TypeScript types for the catalogue
│  ├─ tools/
│  │  ├─ getComponent.ts      # return markup + usage for a named component
│  │  ├─ listComponents.ts    # enumerate available components/blocks/patterns
│  │  ├─ getTokens.ts         # return design tokens (colours, spacing, type)
│  │  ├─ scaffoldUaePass.ts   # generate a compliant UAE Pass login block
│  │  └─ scaffoldEmiratesId.ts# generate a valid Emirates ID input
│  └─ rules/
│     └─ rules.md             # the non-negotiable standards (see §7)
└─ evals/
   └─ screens/                # the 10 test prompts + expected output
```

This is a starting shape, not a cage — adjust as the parsing reality demands, but keep the catalogue, tools, and rules cleanly separated.

## 6. Build order (do these in sequence)

1. **Scaffold the repo and toolchain.** Initialise Node + TypeScript, add the MCP SDK, get an empty server that an assistant can connect to and that responds to a trivial "ping" tool. Prove the connection works before anything else.
2. **Pull and inspect the design system.** Install `@aegov/design-system`. Open its files and confirm, against the live source, the current list of components, blocks, patterns, and where tokens live. **Do not assume the inventory from memory — read it from the installed package and the docs.**
3. **Write the catalogue parser.** Produce `catalog.json`: for each component, capture its name, the HTML (and React, if available) markup, the relevant class names, and a short usage note. This is the heart of Stage 1 and where most of the time goes; real-world data will be messier than expected.
4. **Expose the read tools.** `listComponents`, `getComponent`, `getTokens`. Verify an assistant can call them and get clean, usable data.
5. **Build the scaffolders.** `scaffoldUaePass` and `scaffoldEmiratesId` — the two highest-value, UAE-specific, easy-to-get-wrong pieces. These should emit correct, RTL-aware, bilingual-ready starting code.
6. **Write the rules file** (see §7) and ensure the server surfaces it so the assistant treats the rules as constraints.
7. **Run the evals.** Work through the ten screens until the exit test in §3 passes. Iterate on the catalogue and tool descriptions — not on hand-edited output.
8. **Write the README and publish.** Clear install steps for Cursor, Claude Code, and Copilot. Publish open source under MIT, matching the design system's own licence.

## 7. The rules file — non-negotiables to encode

These must be expressed clearly so a connected assistant respects them automatically:

- **Accessibility:** target **WCAG 2.2 Level AA**. (The legal baseline is 2.1 AA; build to 2.2 to be safe.)
- **UAE Pass:** any login must use the **UAE Pass** block — it is mandatory, not optional.
- **Emirates ID:** the input must follow the official format `784-NNNN-NNNNNNN-N`, with masking and pattern validation.
- **Bilingual + RTL:** Arabic and right-to-left are first-class. Components should default to supporting both, never English-only.
- **Tokens only:** use the design system's own colour, spacing, and type tokens — never arbitrary hard-coded values.
- **Components over custom:** prefer an official component/block/pattern over a hand-rolled one wherever one exists.

## 8. Guardrails and cautions

- **Verify versions live.** Both the design system (v3.x) and the MCP SDK move. At build time, check the actual installed versions and the current SDK API rather than trusting any version numbers written here.
- **Arabic quality is a known weak spot.** Flag anything Arabic-related for a native-speaker check; do not silently "improve" Arabic text.
- **Pin dependencies.** Lock the design system and SDK versions so the catalogue stays stable; bump them deliberately.
- **Stay open and clean.** This is a credibility play with a public-sector audience — readable code, good README, MIT licence.
- **Don't rebuild the regulator's chatbot.** This is a developer tool that returns runnable components and integrates into IDEs — not a Q&A chat experience.

## 9. First message to give Claude Code

> "Read `STAGE1-HANDOFF.md` in this repo. Then start with build step 1: scaffold a Node + TypeScript MCP server using the official MCP SDK, with a single trivial `ping` tool, so we can confirm an assistant can connect. Do not move past step 1 until the connection is proven. Check the current MCP SDK API from its official docs before writing the server."

---

## 10. Verified reality after package inspection (recorded 2026-06-15, append-only log)

> This section records what was confirmed by inspecting the **installed** package, superseding any earlier assumptions in §§1–9. Where this section and the prose above disagree, this section wins.

### 10.1 Component inventory is package-sourced and authoritative

- `@aegov/design-system` is pinned at **exactly `3.0.7`** (no caret).
- The package is a **Tailwind CSS v4 plugin**, not a tree of per-component files. Component definitions are compiled CSS-in-JS inside `dist/plugin.js`, split across three layers: `@layer aegov-base`, `@layer aegov-components`, `@layer aegov-utilities`.
- **27 component class-roots** (from **41** distinct `.aegov-*` classes), obtained by recursive introspection of the compiled stylesheet — **not** from docs or memory. This **replaces the earlier inferred count of 25** (the shallow scan missed `.aegov-file-input-control` and `.aegov-mobile-accordion`, which appear only in nested rules).
- Authoritative artifact: **`inventory/components.json`**, regenerated by **`scripts/extract-inventory.mjs`** (`node scripts/extract-inventory.mjs`). Re-run after any version bump; never hand-edit the JSON.
- Of the 27 roots, 2 are support/sub-parts rather than standalone components (`aegov-backdrop`, an overlay primitive shared with modal; `aegov-mobile`, the header's `.aegov-mobile-accordion` variant). Standalone user-facing components = 25. The JSON keeps all 27 with their member classes and source layers so the taxonomy decision stays explicit.

### 10.2 Two-source architecture — components vs blocks/patterns

This is the central verified fact that shapes the parser:

- **Components and tokens ship as code in the npm package.** They are authoritative, version-pinned, and machine-introspectable. This is the trusted tier.
- **Blocks and patterns do NOT ship as code.** They exist **only** in the website docs at `designsystem.gov.ae`. They must be modelled as a **separate, clearly-marked, docs-sourced path** — never conflated with package-sourced data.
- Every **docs-sourced record must carry**: a **source URL**, a **retrieved-on date** (ISO `YYYY-MM-DD`), and a **`needs-revalidation` trust flag**. These are mandatory, not optional metadata.

### 10.3 rules-core taxonomy + provenance model (APPROVED 2026-06-15; schema in `src/catalog/types.ts`)

**Taxonomy (Q1, approved).** Each component record is **keyed by its CSS class-root** (the verifiable package truth, e.g. `aegov-btn`). Docs name(s) attach as **aliases** (`docsNames`), with a **one-line `taxonomyNote`** whenever a root splits or merges docs concepts (e.g. `aegov-check` covers checkbox + radio). `docsNames`/`taxonomyNote` are **populated in the docs-sourcing pass**, not from memory — they stay empty in the package-only build. Beyond identity, every component record has an explicit **`rules` slot** for attached constraints (accessibility, mandated usage, RTL behaviour). Capturing the *standard*, not just the markup, is the point of rules-core; the `rules` slot is filled from sourced standards (each rule carrying its own provenance).

**Provenance (Q2, approved).** Every record carries a discriminated `provenance` field so the two tiers are distinct at the type, storage, and tool-output levels:

```ts
type Provenance =
  | {
      tier: 'package';            // components, tokens
      package: '@aegov/design-system';
      version: string;            // exact pinned version, e.g. "3.0.7"
      extractedFrom: string;      // e.g. "dist/plugin.js"
      method: 'compiled-css-introspection';
      contentHash: string;        // sha256 of NORMALIZED extracted content (not raw source)
    }
  | {
      tier: 'docs';               // blocks, patterns, usage guidance not in the package
      sourceUrl: string;          // canonical designsystem.gov.ae URL
      retrievedOn: string;        // ISO date the page was captured
      contentHash: string;        // sha256 of NORMALIZED extracted content (code example +
                                  // guidance text), NOT raw page HTML — so drift-checks
                                  // signal real changes, not cosmetic markup churn
      docsVersion: string | null; // captured if the docs expose one, else null
    };
```

Design rules for the model:
- **Discriminated union on `provenance.tier`** — TypeScript enforces that docs-tier records *must* have `sourceUrl` + `retrievedOn` + `contentHash`, and package-tier records *must* have `version` + `extractedFrom` + `contentHash`. A docs record without a source URL or date won't compile.
- **Normalized content hash** — stored for *both* tiers. For docs records it hashes the extracted code example + guidance text (never raw HTML), so a later drift-check distinguishes a real content change from cosmetic page churn. For package records it hashes the component's normalized CSS subtree.
- **No trust-level taxonomy yet.** Docs records are provisional by definition and must be revalidated, but we deliberately do **not** invent finer trust categories until we have seen the real docs. **`UAE Pass` and `Emirates ID` are high-stakes** and must be verified especially carefully against source; finer categories can emerge from there.
- **Tier is fixed by record type in v1:** components and tokens are *only ever* `tier: 'package'`; blocks and patterns are *only ever* `tier: 'docs'`. If a future package version ships blocks as code, those records migrate to the package tier on a deliberate bump.
- **Storage mirrors provenance:** package-sourced data is generated into `catalog/catalog.json` (built by `scripts/build-catalog.mjs` from the authoritative `inventory/components.json`); docs-sourced records populate the same catalogue's `blocks`/`patterns` arrays and the `rules`/`docsNames`/`markup` slots, each carrying docs provenance.
- **Tools surface the tier:** `listComponents` / `getComponent` / `getTokens` return package-tier data as authoritative; any tool returning a block/pattern or a docs-sourced rule includes its `provenance` so the assistant (and the human in the loop) sees the source URL and retrieval date. `validate_snippet` weights confidence by tier — package-sourced classes validate with certainty; docs-sourced block structure validates best-effort and is flagged.

### 10.4 v1 scope boundary

- **v1 targets the core `@aegov/design-system` (HTML/CSS, Tailwind 4) only.** The separate **`@aegov/design-system-react`** package (verified on npm, latest `1.1.2` as of 2026-06-15) is **out of scope for v1**, to be revisited only after adoption.

### 10.5 Docs-sourcing pass — verified findings (recorded 2026-07-07)

The docs tier was captured from `designsystem.gov.ae` (snapshot 2026-07-07, 42/42 pages: **28 components, 8 blocks, 6 patterns**). Pipeline: `scripts/fetch-docs.mjs` (network → `.docs-cache/`, gitignored, page list discovered from the live nav) → `scripts/extract-docs.mjs` (offline, deterministic → `inventory/docs.json`) → `scripts/build-catalog.mjs` (merges both tiers → `catalog/catalog.json`, schemaVersion 2). The page→root mapping is a **reviewed artifact** (`inventory/docs-map.json`), first derived from class-usage evidence, then hand-reviewed; the build **fails** on any mapping the evidence contradicts, any unmapped new docs page, and any docs class absent from the package that is not explicitly acknowledged in `knownDocsOnlyClasses`.

Verified findings, in decreasing order of consequence:

1. **No UAE Pass block/pattern exists anywhere in the docs.** UAE Pass appears only as example *content* in the banner component (an account-connection banner, including an official Arabic RTL variant). `scaffoldUaePass` therefore **cannot be docs-sourced from designsystem.gov.ae** and needs the official UAE Pass developer guidelines as an additional source — treat as its own sourcing decision when building the scaffolders (build step 5).
2. **The "blocks do not ship as code" finding (§10.2) needs refinement:** `aegov-header`, `aegov-footer`, `aegov-hero` styles DO ship in the package; the docs merely document them as blocks. Markup is docs-only, styling is package-tier. Captured per-root in `taxonomyNotes`.
3. **Real docs↔package drift (5 classes, acknowledged in `knownDocsOnlyClasses`):** `aegov-newslette` (typo in the newsletter block example; no such class ships), `aegov-pagination-larger`/`-smaller`, `aegov-slider-next`/`-prev` — all used by docs examples, none defined in 3.0.7 compiled CSS. `validate_snippet` must not treat these as valid package classes.
4. **Docs merges:** `aegov-check` covers docs 'Checkbox' + 'Radio'; `aegov-form` covers docs 'Text Input' + 'Select' + 'Textarea' + 'Range Slider'. Two docs component pages have **no package class-root** — 'Navigation' and 'Slider' are compositions (slider = slick-carousel over `aegov-card`) — modelled as `docsOnlyComponents` (new `DocsArtifact.type: 'component'`).
5. **Pattern pages are guidance-only** (verified: zero code examples on all 6, including Emirates ID) — their content lands in `rules`, `markup: null`. The Emirates ID page specifies display format `784-1945-1234567-0`, masking (`784-1945-XXXXXXX-X`), and HTML `pattern` validation; input rules like "no spaces/dashes required from the user".
6. **Schema evolution (v2):** `ComponentRecord.examples: MarkupExample[]` added — the docs carry many variant examples per component (184 total), a single canonical markup was not enough; `Catalog.docsOnlyComponents` added. Canonical `markup` = the docs "code structure" skeleton where present.
7. **Version branding:** page `<title>`s still say "UAE design system 2.0" on 2 of 42 pages (button, breadcrumbs); the site homepage announces 3.0 as current. Captured per page as `docsVersion` (`"2.0"` or `null` — no page exposes 3.x).
8. **Coverage notes:** 25/27 roots carry docs names (`aegov-backdrop`, `aegov-mobile` are support roots with no docs page); 5 package classes are never used in any docs example (`aegov-backdrop`, `aegov-card-group`, `aegov-hero-static`, `aegov-modal-backdrop`, `aegov-step-title`). Extraction excises live visual-demo tab panels (structure-keyed: panels without `<pre>`) so demo markup never pollutes guidance text; aegov-like strings in `id` attributes (ARIA wiring) are not counted as classes.

Catalogue after the pass: 27 components (22 with markup, 25 docs-named), 223 tokens, 8 blocks, 6 patterns, 2 docs-only components, **133 rules**, **184 markup examples**; every docs record carries `sourceUrl` + `retrievedOn: "2026-07-07"` + normalized `contentHash` + `docsVersion`. All docs content is provisional (`needs-revalidation` by definition, per §10.3) pending Alam's review against the live site — **especially the Emirates ID pattern content (high-stakes)**. Arabic text inside captured docs examples (e.g. the banner RTL variant) is official docs content, preserved verbatim — never edited.

### 10.6 Step-5 sourcing decisions (recorded 2026-07-07)

- **UAE Pass source: `docs.uaepass.ae` — confirmed canonical by Alam** ("the real portal we follow for UAE Pass integrations"). Verified live: official developer docs (TDRA / Digital Dubai / ADDA), fetchable, and it publishes an **`llms.txt`** index with every page available as raw markdown — source the UAE Pass scaffolder through the same snapshot → extract → docs-provenance pipeline as the DLS docs. Key pages: `guidelines/design-guidelines/button-guidelines` (+ `button-assets`, `button-states-and-feedback`, `dos-and-donts`; variants incl. "Sign in with UAE PASS", "Continue with UAE PASS") and `feature-guides/authentication/web-application` (OAuth2 authorize → token → userinfo; staging vs production).
- **`scaffoldEmiratesId` agreed behaviour** (from the captured pattern rules + §7 non-negotiables, sanity-check pending with Alam): `aegov-form-control` input, accepts 15 raw digits (user never required to type spaces/dashes), auto-formats to `784-XXXX-XXXXXXX-X`, validates `^784-\d{4}-\d{7}-\d$`, bilingual labels (Arabic marked for native review), masked display (`784-1945-XXXXXXX-X` convention) with an explicit reveal control.
- **MCP read tools (step 4) are live** as of `c23ce2f`: `listComponents` / `getComponent` / `getTokens` + `ping`; 12/12 smoke checks over real stdio. Assistants must reconnect the server to see them.
- **Pending Alam reviews** (non-blocking): the `emirates-id-input` pattern record vs the live page + real-practice judgment (incl. masking convention), and `inventory/docs-map.json` mapping decisions (`navigation`/`slider` → no package root; checkbox+radio and 4 form controls merges).

### 10.7 Step 5 shipped: UAE Pass sourcing + scaffolders + validate_snippet (recorded 2026-07-07)

- **UAE Pass docs sourced** through the pipeline agreed in §10.6: `scripts/fetch-uaepass.mjs` (network → `.uaepass-cache/`, gitignored; page list discovered from the live `llms.txt`, scoped to `guidelines/design-guidelines*` + `feature-guides/authentication/web-application*`; snapshot 2026-07-07, 53/53 pages as raw markdown) → `scripts/extract-uaepass.mjs` (offline, deterministic → `inventory/uaepass.json`; captures sections/tables/code/attachments/figure-captions, normalized `contentHash` per page) → `scripts/build-uaepass.mjs` (reviewed curation → `catalog/uaepass.json`: 31 verbatim rules, staging+production OAuth2 endpoints, 7 authorize params, 6 button variants, 3 appearances, min-size spec, 6 official asset downloads). Build fails on unaccounted pages and on endpoint/param/size table drift. Verified findings: button appearances are white / white-outline / black only; title text black or white only; logo only black-or-white **with green+red accents**; min 140×30pt, margin 1/10 height; sign-in and sign-up buttons never on the same page; "Continue with UAE PASS" requires document-sharing disclosure; "Powered by UAE PASS" wording requires written consent. **Arabic button titles exist in the docs only as images** — scaffolder Arabic strings are therefore GENERATED and flagged for native review; official Arabic artwork is in the downloadable assets.
- **Three new MCP tools** (server now has 7): `scaffoldUaePass` (variant/appearance/language/environment/radius; emits `aegov-btn` + aeblack/whitely token utilities, `{{...}}` integration placeholders, per-request-state OAuth note, relevant verbatim rules, asset links; markup is package-tier, guidance docs-tier high-stakes), `scaffoldEmiratesId` (per the §10.6 agreed behaviour, bilingual, masked display + reveal; serves the captured pattern rules), `validate_snippet` (tiered confidence: aegov-* class identity verified against the pinned package — `knownDocsOnlyClasses` now baked into `catalog.json` meta, schemaVersion 3 — non-aegov classes checked against docs-example usage best-effort; heuristic checks for img alt, button type, unmasked/unvalidated Emirates ID, Arabic-without-RTL).
- **19/19 smoke checks** over real stdio, including validate_snippet round-tripping scaffoldEmiratesId output clean.
- **Pending Alam reviews** (non-blocking, high-stakes): generated Arabic strings in both scaffolders (native review); `build-uaepass.mjs` curation map (RULE_PAGES kinds, OUT_OF_SCOPE list — notably account-linking + error-messages pages deliberately unconsumed in v1); black-appearance mapping to `aeblack-950` utilities vs official artwork colors.
### 10.8 Step 6 in progress: eval suite built, first screen passing (recorded 2026-07-07)

- **Eval suite** (`/evals`, `npm run evals`): 10 screen specs grounded in the official TDRA page templates (`design-refs/AEGOV-Templates/`, provided by Alam, kept outside the repo), each a natural-language `prompt` + machine `checks`. Judge = `scripts/run-evals.mjs`: boots the real MCP server over stdio, gates every output through `validate_snippet` (errors fail), then applies spec structure checks (required class roots, required/forbidden patterns, document lang, RTL). Discipline (evals/README.md): outputs generated by fresh MCP-connected assistant agents from the prompt alone; generators never see the checks; failures are fixed upstream (catalogue/tool descriptions), never by hand-editing outputs.
- **Spec grounding from the TDRA templates:** every page requires header + footer + the page-rating block ("Did you find this content useful?" — present on all 22 templates); service-details requires the v1–v3 invariant skeleton (breadcrumb, CTA, process as numbered steps, accordion FAQ, service specs, UAE Pass access control) while allowing the CTA/layout variation; screen 09 exercises scaffoldUaePass + bilingual, screen 10 exercises scaffoldEmiratesId + full RTL (and forbids any unmasked full-format EID value).
- **Round 1 status: 1/10 passing.** Screen 06 (Contact us) was generated by a fresh agent purely via the MCP tools and passes all checks (validate_snippet: 0 errors / 0 warnings after the agent fixed button types; 14 package-verified roots). Generation of the other 9 was interrupted by the Claude session usage limit (resets 21:00 Asia/Dubai) — resume/relaunch the agents after reset.
- **Round-1 product findings for the iteration loop** (from agent transcripts, to consider after the full round): (1) `getComponent` on the header block returns ~50k chars — several agents had to spill it to a file and script-extract; consider a size-control option (e.g. canonical-markup-only mode) or trimming variant examples by default; (2) agents note the tools provide no CSS/JS integration reference (how a page actually loads the design system — it ships as a Tailwind v4 plugin, no compiled CDN bundle in the tools' answers); consider surfacing official installation guidance via a tool or listComponents metadata.

- **Artifact lint added** (`scripts/validate-catalog.mjs`, `npm run validate`, chained onto `catalog` and `uaepass:build`): the pipelines are deterministic, so they reproduce their own parsing bugs perfectly and `contentHash` only detects source drift, never extractor misreadings — every text-corruption class found by hand (stray `\r`, undecoded entities, GitBook `{% %}` residue, orphan backslash escapes, markup leaking into text fields) is now a build-failing check, plus structural invariants (provenance completeness, unique ids, cross-refs, docs-only/package class collision) and high-stakes guards (endpoints on the right uaepass.ae identity hosts per environment, documented authorize params incl. `state`, Emirates ID record keeps 784-format + masking content, min-size 140×30pt). Verified adversarially: 13/13 injected corruption classes detected. Bare tag mentions in docs prose (e.g. "associate the `<label>` element") are legitimate; only tags **with attributes** count as leaked markup.
