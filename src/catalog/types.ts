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
  /** Optional usage notes from the docs (for variant examples: the docs section heading). */
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
  /** Canonical markup example (the docs "code structure" skeleton); null until docs-sourced. */
  markup: MarkupExample | null;
  /**
   * Variant markup examples from the docs (sizes, icons, states, RTL, …).
   * The docs turned out to carry many per component — a single canonical
   * example was not enough for an assistant to emit correct variants.
   */
  examples: MarkupExample[];
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
 * A docs-sourced block, pattern, or docs-only "component".
 *
 * `type: "component"` covers docs component pages with no package class-root
 * (verified: 'Navigation' and 'Slider' are compositions of utilities/other
 * components) — they are real docs content but must not masquerade as
 * package-tier components.
 */
export interface DocsArtifact {
  /** Stable slug. */
  id: string;
  name: string;
  type: "block" | "pattern" | "component";
  markup: MarkupExample | null;
  /** Additional markup examples beyond the canonical one. */
  examples: MarkupExample[];
  rules: Rule[];
  /**
   * Package class-roots whose classes appear in this artifact's markup examples
   * (mechanically derived, sorted). Links docs artifacts to the package-tier
   * components they build on — e.g. the header block to `aegov-header`.
   */
  packageClassRoots: string[];
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
    /**
     * Docs↔package drift: classes used by docs examples that do NOT ship in the
     * pinned package (typos + undefined hooks), keyed by class name with the
     * reviewed explanation. validate_snippet must not accept these as valid.
     */
    knownDocsOnlyClasses: Record<string, string>;
  };
  components: ComponentRecord[];
  tokens: TokenRecord[];
  /** Docs-sourced blocks (markup docs-only; header/footer/hero styles ship in the package). */
  blocks: DocsArtifact[];
  /** Docs-sourced patterns (guidance-only pages; typically no markup). */
  patterns: DocsArtifact[];
  /** Docs component pages with no package class-root (navigation, slider). */
  docsOnlyComponents: DocsArtifact[];
}

// --- UAE Pass guidance (catalog/uaepass.json) ---------------------------------------
//
// Sourced from docs.uaepass.ae (STAGE1-HANDOFF.md §10.6: confirmed canonical),
// via the same snapshot → extract → curated-build pipeline as the DLS docs.
// Everything here is docs-tier and HIGH-STAKES: provisional, needs revalidation.

/** A UAE Pass rule: verbatim page text from docs.uaepass.ae. */
export interface UaePassRule {
  kind: RuleKind;
  /** The source page's display name, e.g. "Logo and Title Colors". */
  topic: string;
  /** The page's guidance text, verbatim. */
  statement: string;
  provenance: DocsProvenance;
}

/** OAuth2 endpoint set for one UAE Pass environment. */
export interface UaePassEndpointSet {
  authorization: string;
  token: string;
  userInfo: string;
  logout: string;
}

export interface UaePassGuidance {
  meta: {
    schemaVersion: number;
    origin: string;
    retrievedOn: string;
    note: string;
  };
  /** Documented button wordings; ids are ours, labels are the docs' phrasing. */
  buttonVariants: Array<{ id: string; label: string | null; sourceUrl: string }>;
  /** white / outline / black — the only permitted appearances. */
  appearances: Array<{ id: string; sourceUrl: string }>;
  radiusOptions: Array<{ id: string; note: string; sourceUrl: string }>;
  minSize: {
    minWidth: string;
    minHeight: string;
    minMargin: string;
    preserveAspectRatio: boolean;
    provenance: DocsProvenance;
  };
  endpoints: {
    staging: UaePassEndpointSet;
    production: UaePassEndpointSet;
    provenance: DocsProvenance;
  };
  authorize: {
    params: Array<{ name: string; type: string; description: string }>;
    provenance: DocsProvenance;
  };
  /** Official downloadable button artwork (SVG/PNG) — never hand-drawn. */
  assets: Array<{ label: string | null; url: string; provenance: DocsProvenance }>;
  rules: UaePassRule[];
  /** Image-only guideline pages: guidance exists but only as figures. */
  visualGuidance: Array<{
    topic: string;
    images: Array<{ url: string; caption: string | null }>;
    provenance: DocsProvenance;
  }>;
}
