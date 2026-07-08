/**
 * Shared machinery for the read tools: assistant-facing views of catalogue
 * records, and the name-resolution index.
 *
 * Views are deliberately a *projection* of catalog.json, optimized for LLM
 * consumption: per-record docs provenance is compacted to a `source` URL on
 * each rule/example, with the full provenance (retrievedOn, docsVersion,
 * trust) listed once per distinct source in `docsSources`. The catalogue file
 * itself keeps every hash — nothing is lost, only de-duplicated in transit.
 */
import type {
  Catalog,
  ComponentRecord,
  DocsArtifact,
  DocsProvenance,
  MarkupExample,
  Rule,
} from "../catalog/types.js";

export const DOCS_TRUST =
  "docs-sourced from designsystem.gov.ae — provisional, needs revalidation against the live site";

/** Uniform text-JSON tool result. */
export function json(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function jsonError(payload: unknown) {
  return { ...json(payload), isError: true };
}

function docsSource(p: DocsProvenance) {
  return {
    url: p.sourceUrl,
    retrievedOn: p.retrievedOn,
    docsVersion: p.docsVersion,
    trust: DOCS_TRUST,
  };
}

/** Distinct docs sources across a record's docs-sourced parts, by URL. */
function docsSourcesOf(parts: Array<MarkupExample | Rule | null>, extra?: DocsProvenance) {
  const byUrl = new Map<string, ReturnType<typeof docsSource>>();
  if (extra) byUrl.set(extra.sourceUrl, docsSource(extra));
  for (const part of parts) {
    if (!part) continue;
    const p = part.provenance;
    if (p.tier === "docs") byUrl.set(p.sourceUrl, docsSource(p));
  }
  return [...byUrl.values()].sort((a, b) => (a.url < b.url ? -1 : 1));
}

const CLASS_ATTR_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * Docs examples are served verbatim — including the handful of classes the
 * docs use that do NOT ship in the pinned package (catalog.meta
 * .knownDocsOnlyClasses, e.g. aegov-pagination-larger). Annotate any affected
 * example so an assistant copying it knows to drop/replace those classes
 * instead of failing validate_snippet after the fact.
 */
function driftClassesIn(html: string, drift: Record<string, string>): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(CLASS_ATTR_RE)) {
    for (const token of (m[1] ?? m[2]).split(/\s+/)) {
      if (token in drift) found.add(token);
    }
  }
  return [...found].sort();
}

function exampleView(m: MarkupExample, drift: Record<string, string>) {
  const driftClasses = driftClassesIn(m.html, drift);
  return {
    html: m.html,
    notes: m.notes ?? null,
    source: m.provenance.sourceUrl,
    ...(driftClasses.length
      ? {
          driftWarning:
            `This official docs example uses class(es) that do NOT ship in the pinned package ` +
            `and will fail validation — remove or replace them: ${driftClasses.join(", ")}`,
        }
      : {}),
  };
}

function ruleView(r: Rule) {
  return {
    kind: r.kind,
    statement: r.statement,
    source:
      r.provenance.tier === "docs"
        ? r.provenance.sourceUrl
        : `${r.provenance.package}@${r.provenance.version}`,
  };
}

/** Docs artifacts (blocks/patterns/docs-only) whose examples use this root. */
function usedBy(catalog: Catalog, classRoot: string) {
  return [...catalog.blocks, ...catalog.patterns, ...catalog.docsOnlyComponents]
    .filter((a) => a.packageClassRoots.includes(classRoot))
    .map((a) => ({ type: a.type, id: a.id, name: a.name }));
}

export function componentView(catalog: Catalog, c: ComponentRecord) {
  const drift = catalog.meta.knownDocsOnlyClasses;
  return {
    kind: "component",
    tier: "package",
    classRoot: c.classRoot,
    docsNames: c.docsNames,
    taxonomyNote: c.taxonomyNote,
    classes: c.classes,
    layers: c.layers,
    markup: c.markup ? exampleView(c.markup, drift) : null,
    examples: c.examples.map((e) => exampleView(e, drift)),
    rules: c.rules.map(ruleView),
    usedByDocsArtifacts: usedBy(catalog, c.classRoot),
    provenance: {
      tier: "package",
      package: c.provenance.package,
      version: c.provenance.version,
      extractedFrom: c.provenance.extractedFrom,
      note: "class identity and styling are authoritative for the pinned package version",
    },
    docsSources: docsSourcesOf([c.markup, ...c.examples, ...c.rules]),
  };
}

export function artifactView(catalog: Catalog, a: DocsArtifact) {
  const drift = catalog.meta.knownDocsOnlyClasses;
  return {
    kind: a.type === "component" ? "docs-only-component" : a.type,
    tier: "docs",
    id: a.id,
    name: a.name,
    packageClassRoots: a.packageClassRoots,
    markup: a.markup ? exampleView(a.markup, drift) : null,
    examples: a.examples.map((e) => exampleView(e, drift)),
    rules: a.rules.map(ruleView),
    provenance: docsSource(a.provenance),
  };
}

// --- name resolution ---------------------------------------------------------

export type Resolved =
  | { kind: "component"; record: ComponentRecord }
  | { kind: "artifact"; record: DocsArtifact };

/** Normalize a lookup key: lowercase, dash-joined, no leading dot. */
export function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/^\./, "").replace(/[\s_]+/g, "-");
}

/**
 * Build the lookup index. Insertion order encodes priority (first write wins):
 *   1. component class-roots (aegov-btn)
 *   2. docs artifact ids (header, emirates-id-input) — so "header" resolves to
 *      the block that actually carries the official markup, not the bare root
 *   3. docs artifact names (Emirates ID)
 *   4. component docs names (Button, Checkbox)
 *   5. short roots (btn, check)
 *   6. member classes (aegov-check-item)
 */
export function buildIndex(catalog: Catalog): Map<string, Resolved> {
  const index = new Map<string, Resolved>();
  const put = (key: string, value: Resolved) => {
    const k = normalizeKey(key);
    if (k && !index.has(k)) index.set(k, value);
  };
  const artifacts = [...catalog.blocks, ...catalog.patterns, ...catalog.docsOnlyComponents];

  for (const c of catalog.components) put(c.classRoot, { kind: "component", record: c });
  for (const a of artifacts) put(a.id, { kind: "artifact", record: a });
  for (const a of artifacts) put(a.name, { kind: "artifact", record: a });
  for (const c of catalog.components)
    for (const n of c.docsNames) put(n, { kind: "component", record: c });
  for (const c of catalog.components)
    put(c.classRoot.replace(/^aegov-/, ""), { kind: "component", record: c });
  for (const c of catalog.components)
    for (const cls of c.classes) put(cls, { kind: "component", record: c });

  return index;
}

/** Every canonical identifier, for miss messages and the list tool. */
export function knownIdentifiers(catalog: Catalog) {
  return {
    componentClassRoots: catalog.components.map((c) => c.classRoot),
    blockIds: catalog.blocks.map((b) => b.id),
    patternIds: catalog.patterns.map((p) => p.id),
    docsOnlyComponentIds: catalog.docsOnlyComponents.map((d) => d.id),
  };
}
