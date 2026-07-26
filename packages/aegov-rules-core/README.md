# @dlsforge/aegov-rules-core

**Machine-readable model of the UAE Design System (AEGOV DLS)** — component schemas, resolved design tokens, a catalogue loader, and the DLS rule engine. This is the shared foundation every DLSForge tool trusts: the [`@dlsforge/aegov-mcp`](https://www.npmjs.com/package/@dlsforge/aegov-mcp) server (which helps assistants *generate* government UI) and [`@dlsforge/aegov-audit`](https://www.npmjs.com/package/@dlsforge/aegov-audit) / Mizan (which *audits* it) both consume this core, so the standard is defined **once** and both tools follow.

> **Community project. Not affiliated with or endorsed by TDRA.**

## What's inside

- **The catalogue** — components, blocks, patterns and docs-only artifacts of the AEGOV DLS, plus resolved design tokens and the header/footer **block conformance contracts**, as versioned JSON with a typed loader.
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
- `blockProbeSpec(contracts)`, `checkBlockContracts(contracts, probe)`, `staleBlockContracts(contracts)` — block conformance (see below).
- All catalogue/schema types are re-exported (`Finding`, `ClassIndex`, `ClassBuckets`, …).

### Block conformance contracts

`catalog.blockContracts` holds the invariants the docs actually mandate for the header and footer blocks — the block roots, the mobile menu and footer accordion, the documented 7-item limit on a primary navigation, a copyright year that changes. They are curated rather than derived: the docs header example is ~50 KB of one entity's menu content, so "does this page match the example" is not a question any real site passes.

Two guards keep a curated artifact honest, both enforced when the catalogue is built:

- **Citations** — each requirement quotes the docs sentence or markup that mandates it, and the build fails if that quote is not verbatim on the page. A contract cannot claim a mandate the docs do not contain.
- **Staleness** — each contract carries the page `contentHash` *a human last reviewed it against*, held as a literal in `scripts/block-contracts.mjs` so it can disagree with the live page. The build refuses to emit when they differ, forcing a re-read. `staleBlockContracts()` re-checks the same invariant at runtime, for consumers evaluating catalogue data they did not build.

Unlike the string-level checks, these are containment questions, so the library does not parse HTML for them: `blockProbeSpec()` returns a flat list of selector queries, the consumer runs them against whatever DOM it has, and `checkBlockContracts()` turns the results into `satisfied` / `violated` / `not-applicable`. Every requirement is gated — a missing anchor yields `not-applicable`, never a silent pass.

```ts
const contracts = loadCatalog().blockContracts;
const spec = blockProbeSpec(contracts);
// …run spec.present / spec.groups / spec.texts against your DOM…
const results = checkBlockContracts(contracts, probe);
```

## Keeping the catalogue honest

The catalogue is regenerated from the pinned package and the live docs — never hand-edited outputs. `npm run validate` lints it and checks its invariants (class set exactly matches a fresh introspection of the package, docs-tier records carry full provenance, token values match the package's own theme source). Regeneration scripts: `inventory`, `docs:fetch`/`docs:extract`, `catalog`, `uaepass:*`.

## License

MIT — see [LICENSE](../../LICENSE). Community project. Not affiliated with or endorsed by TDRA.
