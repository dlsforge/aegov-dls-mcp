// Authoritative component-inventory extractor.
//
// Introspects the INSTALLED @aegov/design-system compiled stylesheet
// (dist/plugin.js) and emits inventory/components.json. This is the single
// source of truth for the component class-root count — regenerate it after
// any version bump rather than hand-editing the output.
//
//   node scripts/extract-inventory.mjs
//
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const pkg = require('@aegov/design-system/package.json');
const styles = require('@aegov/design-system/dist/plugin.js');

// Recursively collect every selector key anywhere in the compiled object,
// including nested rules (e.g. `& .aegov-mobile-accordion`), tagging the
// top-level @layer each selector descends from.
const selectorsByLayer = {};
for (const layer of Object.keys(styles)) {
  const found = new Set();
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        found.add(key);
        walk(node[key]);
      }
    }
  })(styles[layer]);
  selectorsByLayer[layer] = found;
}

// Extract every `.aegov-*` class token from every selector string.
const classRe = /\.aegov-[a-z0-9]+(?:-[a-z0-9]+)*/g;
const classToLayers = new Map();
for (const [layer, sels] of Object.entries(selectorsByLayer)) {
  for (const sel of sels) {
    const matches = sel.match(classRe) || [];
    for (const cls of matches) {
      if (!classToLayers.has(cls)) classToLayers.set(cls, new Set());
      classToLayers.get(cls).add(layer.replace('@layer ', ''));
    }
  }
}

const allClasses = [...classToLayers.keys()].sort();

// Derive class-roots: `.aegov-<firstSegment>`.
const rootToClasses = new Map();
for (const cls of allClasses) {
  const root = 'aegov-' + cls.replace(/^\.aegov-/, '').split('-')[0];
  if (!rootToClasses.has(root)) rootToClasses.set(root, []);
  rootToClasses.get(root).push(cls);
}

const roots = [...rootToClasses.keys()].sort();

const inventory = {
  source: {
    package: '@aegov/design-system',
    version: pkg.version,
    compiledFrom: 'dist/plugin.js',
    method: 'recursive introspection of the Tailwind plugin CSS-in-JS object',
  },
  classRootCount: roots.length,
  classRoots: roots.map((root) => ({
    root,
    classes: rootToClasses.get(root),
    layers: [...new Set(rootToClasses.get(root).flatMap((c) => [...classToLayers.get(c)]))].sort(),
  })),
  allAegovClasses: allClasses,
};

mkdirSync(join(repoRoot, 'inventory'), { recursive: true });
const outPath = join(repoRoot, 'inventory', 'components.json');
writeFileSync(outPath, JSON.stringify(inventory, null, 2) + '\n');

console.log(`@aegov/design-system@${pkg.version}`);
console.log(`Distinct .aegov-* classes : ${allClasses.length}`);
console.log(`Component class-roots     : ${roots.length}`);
console.log(`Written                   : inventory/components.json`);
