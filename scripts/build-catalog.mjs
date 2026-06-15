// Builds the PACKAGE-SOURCED tier of the rules-core catalogue.
//
// Consumes the authoritative class-root inventory (inventory/components.json,
// produced by extract-inventory.mjs) plus the installed package's compiled CSS
// and theme files, and emits catalog/catalog.json conforming to src/catalog/types.ts.
//
// Docs-sourced records (blocks, patterns, rules text, docsNames, markup) are NOT
// produced here — they belong to the docs-sourcing pass and carry docs provenance.
// They are emitted as empty/typed placeholders so tools can rely on the shape.
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

// --- components --------------------------------------------------------------

const components = inventory.classRoots.map((root) => {
  const classSet = new Set(root.classes);
  const content = collectStylesFor(classSet);
  return {
    classRoot: root.root,
    classes: root.classes,
    layers: root.layers,
    docsNames: [], // populated in the docs-sourcing pass
    taxonomyNote: null, // populated in the docs-sourcing pass
    rules: [], // populated from sourced standards
    markup: null, // docs-sourced
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

// --- assemble + write --------------------------------------------------------

const catalog = {
  meta: {
    schemaVersion: 1,
    generatedFrom: { package: pkg.name, version: pkg.version },
  },
  components,
  tokens,
  blocks: [], // docs-sourced; empty in v1
  patterns: [], // docs-sourced; empty in v1
};

mkdirSync(join(repoRoot, "catalog"), { recursive: true });
const outPath = join(repoRoot, "catalog", "catalog.json");
writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n");

const byCategory = tokens.reduce((acc, t) => {
  acc[t.category] = (acc[t.category] || 0) + 1;
  return acc;
}, {});

console.log(`@aegov/design-system@${pkg.version}`);
console.log(`Components (package tier): ${components.length}`);
console.log(`Tokens (package tier)    : ${tokens.length} ${JSON.stringify(byCategory)}`);
console.log(`Blocks / patterns        : 0 / 0 (docs-sourced, deferred)`);
console.log(`Written                  : catalog/catalog.json`);
