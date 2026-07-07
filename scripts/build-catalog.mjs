// Builds the rules-core catalogue: BOTH provenance tiers.
//
// Package tier: consumes the authoritative class-root inventory
// (inventory/components.json, produced by extract-inventory.mjs) plus the
// installed package's compiled CSS and theme files.
//
// Docs tier: consumes the faithful docs extraction (inventory/docs.json,
// produced by extract-docs.mjs from a fetch-docs.mjs snapshot) plus the
// REVIEWED page->root mapping (inventory/docs-map.json). Every docs-sourced
// record carries docs provenance: sourceUrl + retrievedOn + contentHash +
// docsVersion. The mapping is validated against the extraction evidence —
// a contradiction fails the build rather than landing silently.
//
// Output: catalog/catalog.json conforming to src/catalog/types.ts.
// Deterministic given the committed inputs (no clock, no network).
//
//   node scripts/build-catalog.mjs
//
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const pkg = require("@aegov/design-system/package.json");
const styles = require("@aegov/design-system/dist/plugin.js");
const colors = require("@aegov/design-system/src/theme/colors.js");
const inventory = JSON.parse(
  readFileSync(join(repoRoot, "inventory", "components.json"), "utf8"),
);
const docs = JSON.parse(readFileSync(join(repoRoot, "inventory", "docs.json"), "utf8"));
const docsMap = JSON.parse(
  readFileSync(join(repoRoot, "inventory", "docs-map.json"), "utf8"),
);

const EXTRACTED_FROM = "dist/plugin.js";

// --- deterministic normalization + hashing ----------------------------------

/** Recursively sort object keys so serialization is stable. */
function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node).sort()) out[k] = normalize(node[k]);
    return out;
  }
  return node;
}

function sha256(str) {
  return createHash("sha256").update(str).digest("hex");
}

const CLASS_RE = /\.aegov-[a-z0-9]+(?:-[a-z0-9]+)*/g;

/**
 * Collect every style subtree (at any depth) whose selector key references one
 * of the given classes, as a sorted [selector, normalizedValue] list — the
 * "normalized extracted content" we hash for a component.
 */
function collectStylesFor(classSet) {
  const hits = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) {
        const matches = key.match(CLASS_RE) || [];
        if (matches.some((m) => classSet.has(m))) {
          hits.push([key, normalize(node[key])]);
        }
        walk(node[key]);
      }
    }
  })(styles);
  hits.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return hits;
}

function packageProvenance(contentHash, extractedFrom = EXTRACTED_FROM) {
  return {
    tier: "package",
    package: "@aegov/design-system",
    version: pkg.version,
    extractedFrom,
    method: "compiled-css-introspection",
    contentHash,
  };
}

// --- docs-tier helpers -------------------------------------------------------

const fail = (msg) => {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
};

function docsProvenance(page) {
  return {
    tier: "docs",
    sourceUrl: page.url,
    retrievedOn: page.retrievedOn,
    contentHash: page.contentHash,
    docsVersion: page.docsVersion,
  };
}

/** Classify a docs section heading into a Rule kind; null = not a rule section. */
function ruleKindFor(heading) {
  const h = heading.toLowerCase();
  if (/accessib/.test(h)) return "accessibility";
  if (/\brtl\b|right.to.left/.test(h)) return "rtl";
  if (/arabic|bilingual/.test(h)) return "bilingual";
  if (/usage|where to use|when to use|spacing|key elements/.test(h)) return "usage";
  return null;
}

/**
 * Rules from a page's guidance sections. Pattern pages are guidance through and
 * through (no code, buggy heading ids), so there every non-empty section counts;
 * component/block pages contribute only their recognized rule sections.
 */
function rulesFrom(page, { allSections = false } = {}) {
  const rules = [];
  for (const s of page.sections) {
    if (!s.text) continue;
    const kind = ruleKindFor(s.heading) ?? (allSections ? "usage" : null);
    if (!kind) continue;
    rules.push({ kind, statement: s.text, provenance: docsProvenance(page) });
  }
  return rules;
}

/**
 * Canonical markup + variant examples from a page's HTML code blocks.
 * Canonical = the "code structure" section's block (the docs' own skeleton)
 * when present, else the page's first HTML block; the rest become examples.
 */
function markupFrom(page) {
  const sectionsWithHtml = page.sections
    .map((s) => ({ s, blocks: s.codeBlocks.filter((b) => b.language === "html") }))
    .filter((e) => e.blocks.length > 0);
  if (sectionsWithHtml.length === 0) return { markup: null, examples: [] };

  const structure = sectionsWithHtml.find((e) => /code structure/i.test(e.s.heading));
  const canonicalEntry = structure ?? sectionsWithHtml[0];
  const canonicalBlock = canonicalEntry.blocks[0];

  const example = (section, block) => ({
    html: block.code,
    notes: `${page.name}: ${section.heading}`,
    provenance: docsProvenance(page),
  });

  const examples = [];
  for (const { s, blocks } of sectionsWithHtml) {
    for (const b of blocks) {
      if (b === canonicalBlock) continue;
      examples.push(example(s, b));
    }
  }
  return { markup: example(canonicalEntry.s, canonicalBlock), examples };
}

// --- docs-tier validation ----------------------------------------------------

const componentPages = docs.pages.filter((p) => p.section === "components");
const blockPages = docs.pages.filter((p) => p.section === "blocks");
const patternPages = docs.pages.filter((p) => p.section === "patterns");

const rootSet = new Set(inventory.classRoots.map((r) => r.root));
const knownClasses = new Set(
  inventory.classRoots.flatMap((r) => r.classes.map((c) => c.replace(/^\./, ""))),
);
const classToRoot = {};
for (const r of inventory.classRoots)
  for (const c of r.classes) classToRoot[c.replace(/^\./, "")] = r.root;

// 1. Every docs component page must be mapped (a new page appearing on the site
//    must force a deliberate mapping decision, not a silent skip).
for (const p of componentPages) {
  if (!(p.slug in docsMap.componentPages))
    fail(`docs component page '${p.slug}' has no entry in inventory/docs-map.json`);
}
for (const slug of Object.keys(docsMap.componentPages)) {
  if (!componentPages.some((p) => p.slug === slug))
    fail(`docs-map.json maps '${slug}' but no such docs page was extracted`);
}

// 2. Mapped roots must exist in the package inventory, and the page's examples
//    must actually use a class of that root (evidence check).
for (const [slug, entry] of Object.entries(docsMap.componentPages)) {
  if (entry.root === null) continue;
  if (!rootSet.has(entry.root))
    fail(`docs-map.json maps '${slug}' to unknown root '${entry.root}'`);
  const page = componentPages.find((p) => p.slug === slug);
  const usesRoot = page.aegovClassesInExamples.some((c) => classToRoot[c] === entry.root);
  if (!usesRoot)
    fail(
      `docs-map.json maps '${slug}' to '${entry.root}' but the page's examples never use it`,
    );
}

// 3. Docs classes unknown to the package must be explicitly acknowledged.
for (const p of docs.pages) {
  for (const c of p.aegovClassesInExamples) {
    if (!knownClasses.has(c) && !(c in docsMap.knownDocsOnlyClasses))
      fail(
        `docs page '${p.section}/${p.slug}' uses class '${c}' that is neither in the package nor acknowledged in docs-map.json knownDocsOnlyClasses`,
      );
  }
}

// --- components (package identity + docs enrichment) --------------------------

/** Mapped docs pages per root, in slug order for determinism. */
const pagesByRoot = new Map();
for (const [slug, entry] of Object.entries(docsMap.componentPages).sort()) {
  if (entry.root === null) continue;
  const page = componentPages.find((p) => p.slug === slug);
  if (!pagesByRoot.has(entry.root)) pagesByRoot.set(entry.root, []);
  pagesByRoot.get(entry.root).push(page);
}
// Block pages whose styles ship in the package contribute their docs name only;
// their markup/rules live on the block artifact to avoid duplicating content.
const blockNameByRoot = new Map();
for (const [slug, root] of Object.entries(docsMap.blockPagesStyledByPackage)) {
  if (!rootSet.has(root)) fail(`blockPagesStyledByPackage maps '${slug}' to unknown root '${root}'`);
  const page = blockPages.find((p) => p.slug === slug);
  if (!page) fail(`blockPagesStyledByPackage maps '${slug}' but no such block page was extracted`);
  blockNameByRoot.set(root, page.name);
}

const components = inventory.classRoots.map((root) => {
  const classSet = new Set(root.classes);
  const content = collectStylesFor(classSet);
  const pages = pagesByRoot.get(root.root) ?? [];

  const docsNames = pages.map((p) => p.name);
  const blockName = blockNameByRoot.get(root.root);
  if (blockName) docsNames.push(blockName);

  const rules = pages.flatMap((p) => rulesFrom(p));
  let markup = null;
  const examples = [];
  for (const p of pages) {
    const m = markupFrom(p);
    if (markup === null) markup = m.markup;
    else if (m.markup) examples.push(m.markup);
    examples.push(...m.examples);
  }

  return {
    classRoot: root.root,
    classes: root.classes,
    layers: root.layers,
    docsNames,
    taxonomyNote: docsMap.taxonomyNotes[root.root] ?? null,
    rules,
    markup,
    examples,
    provenance: packageProvenance(sha256(JSON.stringify(content))),
  };
});

// --- tokens ------------------------------------------------------------------

const tokens = [];

// Colours: mirror how the plugin emits CSS variables from theme/colors.js.
function pushColor(name, value) {
  tokens.push({
    name,
    value: String(value),
    category: "color",
    provenance: packageProvenance(sha256(String(value)), "src/theme/colors.js"),
  });
}
for (const colorName of Object.keys(colors)) {
  const shades = colors[colorName];
  if (shades && typeof shades === "object") {
    for (const shade of Object.keys(shades)) {
      const suffix = shade === "DEFAULT" ? "" : `-${shade}`;
      pushColor(`--color-${colorName}${suffix}`, shades[shade]);
    }
  } else {
    pushColor(`--color-${colorName}`, shades);
  }
}

// :root custom properties from the base layer (fonts, type scale, shadow, container).
const baseRoot = styles["@layer aegov-base"]?.[":root"] ?? {};
function categorizeVar(name) {
  if (name.startsWith("--font")) return "font";
  if (name.startsWith("--text")) return "typography";
  if (name.startsWith("--shadow")) return "shadow";
  if (name.startsWith("--container")) return "container";
  return "other";
}
for (const name of Object.keys(baseRoot)) {
  const value = String(baseRoot[name]);
  tokens.push({
    name,
    value,
    category: categorizeVar(name),
    provenance: packageProvenance(sha256(value)),
  });
}

// --- docs artifacts: blocks, patterns, docs-only components -------------------

function docsArtifact(page, type, { allSectionRules = false } = {}) {
  const { markup, examples } = markupFrom(page);
  return {
    id: page.slug,
    name: page.name,
    type,
    markup,
    examples,
    rules: rulesFrom(page, { allSections: allSectionRules }),
    provenance: docsProvenance(page),
  };
}

const blocks = blockPages.map((p) => docsArtifact(p, "block"));
// Pattern pages are pure guidance (verified: none carry code examples).
const patterns = patternPages.map((p) => docsArtifact(p, "pattern", { allSectionRules: true }));
const docsOnlyComponents = componentPages
  .filter((p) => docsMap.componentPages[p.slug].root === null)
  .map((p) => docsArtifact(p, "component"));

// --- assemble + write --------------------------------------------------------

const catalog = {
  meta: {
    schemaVersion: 2,
    generatedFrom: { package: pkg.name, version: pkg.version },
  },
  components,
  tokens,
  blocks,
  patterns,
  docsOnlyComponents,
};

mkdirSync(join(repoRoot, "catalog"), { recursive: true });
const outPath = join(repoRoot, "catalog", "catalog.json");
writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n");

const byCategory = tokens.reduce((acc, t) => {
  acc[t.category] = (acc[t.category] || 0) + 1;
  return acc;
}, {});
const named = components.filter((c) => c.docsNames.length > 0).length;
const withMarkup = components.filter((c) => c.markup !== null).length;
const ruleCount =
  components.reduce((n, c) => n + c.rules.length, 0) +
  [...blocks, ...patterns, ...docsOnlyComponents].reduce((n, a) => n + a.rules.length, 0);
const exampleCount =
  components.reduce((n, c) => n + c.examples.length + (c.markup ? 1 : 0), 0) +
  [...blocks, ...patterns, ...docsOnlyComponents].reduce(
    (n, a) => n + a.examples.length + (a.markup ? 1 : 0),
    0,
  );

console.log(`@aegov/design-system@${pkg.version} + docs snapshot ${docs.retrievedOn}`);
console.log(`Components (package tier): ${components.length} (${named} docs-named, ${withMarkup} with markup)`);
console.log(`Tokens (package tier)    : ${tokens.length} ${JSON.stringify(byCategory)}`);
console.log(`Blocks / patterns / docs-only components: ${blocks.length} / ${patterns.length} / ${docsOnlyComponents.length}`);
console.log(`Rules: ${ruleCount}   Markup examples: ${exampleCount}`);
console.log(`Known docs-only classes acknowledged: ${Object.keys(docsMap.knownDocsOnlyClasses).length}`);
console.log(`Written: catalog/catalog.json`);
