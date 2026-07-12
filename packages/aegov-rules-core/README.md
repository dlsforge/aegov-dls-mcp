# @dlsforge/aegov-rules-core

**Machine-readable model of the UAE Design System (AEGOV DLS)** — component schemas, resolved design tokens, a catalogue loader, and the DLS rule engine. This is the shared foundation every DLSForge tool trusts: the [`@dlsforge/aegov-mcp`](https://www.npmjs.com/package/@dlsforge/aegov-mcp) server (which helps assistants *generate* government UI) and [`@dlsforge/aegov-audit`](https://www.npmjs.com/package/@dlsforge/aegov-audit) / Mizan (which *audits* it) both consume this core, so the standard is defined **once** and both tools follow.

> **Community project. Not affiliated with or endorsed by TDRA.**

## What's inside

- **The catalogue** — components, blocks, patterns and docs-only artifacts of the AEGOV DLS, plus resolved design tokens, as versioned JSON with a typed loader.
- **Two provenance tiers, kept honestly apart.** Components and tokens are introspected from the pinned [`@aegov/design-system`](https://www.npmjs.com/package/@aegov/design-system) npm package (**3.0.7** — authoritative, version-pinned). Blocks and patterns do **not** ship as code; they exist only in the [designsystem.gov.ae](https://designsystem.gov.ae) docs, so every docs-sourced record carries a source URL, a retrieved-on date, and a `needs-revalidation` trust flag. Findings grounded in docs-tier records carry docs-tier confidence, never package-tier certainty.
- **The DLS rule engine** — pure, unit-tested functions over an HTML string: class identity vs the pinned package (with did-you-mean suggestions), docs-tier class-evidence checks, drift-class rejection, Emirates ID format/masking/pattern validation, `img` alt, `<button>` type, Arabic-without-RTL, and DMY dates.

## Install

```sh
npm install @dlsforge/aegov-rules-core
```

Node.js ≥ 18. ESM only.

## Usage

```ts
import {
  loadCatalog,
  loadUaePass,
  buildClassIndex,
  validateHtml,
  EID_PATTERN,
} from "@dlsforge/aegov-rules-core";

// The catalogue (components, tokens, docs artifacts) + UAE Pass rules/assets
const catalog = loadCatalog();
const uaePass = loadUaePass();

// Validate an HTML string against the whole DLS rule set
const index = buildClassIndex(catalog);
const { findings, classes } = validateHtml(
  '<button class="aegov-btn">Submit</button>',
  index,
);
// findings: Array<{ level, confidence, message }>

// The mandated Emirates ID pattern, for reuse in your own inputs
EID_PATTERN; // "^784-\\d{4}-\\d{7}-\\d$"
```

### Public API

- `loadCatalog()`, `loadUaePass()` — load the versioned catalogue data.
- `buildClassIndex(catalog)` → `ClassIndex` — the catalogue-derived truth the class checks run against (build once, reuse).
- `validateHtml(html, index)` — run every DLS check in order; returns `{ findings, classes }`.
- Individual checks as pure functions: `checkClassIdentity`, `checkImgAlt`, `checkButtonType`, `checkFullEidValue`, `checkEmiratesIdInputs`, `checkMdyDates`, `checkArabicRtl`, plus `classTokens` and `EID_PATTERN`.
- All catalogue/schema types are re-exported (`Finding`, `ClassIndex`, `ClassBuckets`, …).

## Keeping the catalogue honest

The catalogue is regenerated from the pinned package and the live docs — never hand-edited outputs. `npm run validate` lints it and checks its invariants (class set exactly matches a fresh introspection of the package, docs-tier records carry full provenance, token values match the package's own theme source). Regeneration scripts: `inventory`, `docs:fetch`/`docs:extract`, `catalog`, `uaepass:*`.

## License

MIT — see [LICENSE](../../LICENSE). Community project. Not affiliated with or endorsed by TDRA.
