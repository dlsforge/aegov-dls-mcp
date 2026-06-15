/**
 * rules-core schema — the typed contract for the AEGOV DLS catalogue.
 *
 * Two provenance tiers (see STAGE1-HANDOFF.md §10):
 *  - `package`: components + tokens, introspected from the pinned npm package.
 *               Authoritative, version-pinned, machine-verifiable.
 *  - `docs`:    blocks, patterns, and any usage guidance / rules text that does
 *               NOT ship as code. Provisional — must be revalidated against source.
 *
 * High-stakes note: UAE Pass and Emirates ID rules are high-stakes and must be
 * verified especially carefully against source. We deliberately do NOT define a
 * finer trust-level taxonomy yet — it should emerge once we have seen the real docs.
 */

/** Provenance for data introspected from the installed npm package. */
export interface PackageProvenance {
  tier: "package";
  package: "@aegov/design-system";
  /** Exact pinned version, e.g. "3.0.7". */
  version: string;
  /** Source file within the package, e.g. "dist/plugin.js". */
  extractedFrom: string;
  method: "compiled-css-introspection";
  /** sha256 of the NORMALIZED extracted content (not raw source), for drift checks. */
  contentHash: string;
}

/** Provenance for data sourced from the website docs (designsystem.gov.ae). */
export interface DocsProvenance {
  tier: "docs";
  /** Canonical docs URL the record was captured from. */
  sourceUrl: string;
  /** ISO date (YYYY-MM-DD) the page was retrieved. */
  retrievedOn: string;
  /**
   * sha256 of the NORMALIZED extracted content (code example + guidance text),
   * NOT raw page HTML — so a later drift-check signals a real content change
   * rather than cosmetic markup churn.
   */
  contentHash: string;
  /** Docs version if exposed by the page, else null. */
  docsVersion: string | null;
}

export type Provenance = PackageProvenance | DocsProvenance;

/** Category of an attached rule/constraint. Intentionally coarse for v1. */
export type RuleKind = "accessibility" | "usage" | "rtl" | "bilingual" | "other";

/**
 * A rule/constraint attached to a component, block, or pattern — the standard,
 * not just the markup. Each rule carries its own provenance (usually docs-tier).
 */
export interface Rule {
  kind: RuleKind;
  /** The constraint, in plain language. */
  statement: string;
  /** Optional WCAG success-criterion reference, e.g. "2.2 AA 1.4.3". */
  wcag?: string;
  provenance: Provenance;
}

/** A canonical markup example. Docs-sourced. */
export interface MarkupExample {
  html: string;
  /** Optional usage notes from the docs. */
  notes?: string;
  provenance: DocsProvenance;
}

/**
 * One component record, keyed by its CSS class-root (the verifiable package truth).
 * Identity + classes are package-tier; rules / markup / docs names attach later
 * from the docs-sourcing pass and carry their own provenance.
 */
export interface ComponentRecord {
  /** CSS class-root, e.g. "aegov-btn". Primary key. */
  classRoot: string;
  /** All member `.aegov-*` classes under this root. */
  classes: string[];
  /** Which `@layer`(s) the classes live in. */
  layers: string[];
  /** Docs taxonomy name(s) for this root, as aliases. Empty until docs-sourced. */
  docsNames: string[];
  /**
   * One-liner when a root splits or merges docs concepts
   * (e.g. `aegov-check` covers checkbox + radio). null when the mapping is 1:1
   * or not yet docs-sourced.
   */
  taxonomyNote: string | null;
  /** Attached rules/constraints — accessibility, mandated usage, RTL, etc. */
  rules: Rule[];
  /** Canonical markup example; null until docs-sourced. */
  markup: MarkupExample | null;
  /** Provenance of the identity/classes (package tier). */
  provenance: PackageProvenance;
}

export type TokenCategory =
  | "color"
  | "typography"
  | "font"
  | "spacing"
  | "shadow"
  | "container"
  | "other";

/** A resolved design token. */
export interface TokenRecord {
  /** CSS custom-property name as emitted by the plugin, e.g. "--color-primary-500". */
  name: string;
  value: string;
  category: TokenCategory;
  provenance: PackageProvenance;
}

/**
 * A docs-sourced block or pattern. Placeholder tier in v1 (arrays stay empty
 * until the docs-sourcing path is built); the shape is fixed here so the
 * generator and tools can rely on it.
 */
export interface DocsArtifact {
  /** Stable slug. */
  id: string;
  name: string;
  type: "block" | "pattern";
  markup: MarkupExample | null;
  rules: Rule[];
  provenance: DocsProvenance;
}

/** The full catalogue. */
export interface Catalog {
  meta: {
    schemaVersion: number;
    /**
     * The package tier is fully determined by this pinned version, so the
     * generated artifact stays byte-stable across re-runs (drift is tracked by
     * per-record contentHash, not a wall-clock timestamp). Docs records instead
     * carry their own `retrievedOn` date, set once at capture.
     */
    generatedFrom: { package: string; version: string };
  };
  components: ComponentRecord[];
  tokens: TokenRecord[];
  /** Docs-sourced; empty in v1 until the docs path is built. */
  blocks: DocsArtifact[];
  /** Docs-sourced; empty in v1 until the docs path is built. */
  patterns: DocsArtifact[];
}
