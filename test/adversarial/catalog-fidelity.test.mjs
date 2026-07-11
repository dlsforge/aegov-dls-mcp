/**
 * Adversarial pass — does the shipped catalogue actually agree with the
 * INSTALLED @aegov/design-system@3.0.7? Independent re-extraction: walk the
 * compiled Tailwind plugin object ourselves (same method as
 * scripts/extract-inventory.mjs, reimplemented so a bug there can't hide) and
 * compare against catalog/catalog.json. Also: version pin coherence and raw
 * palette token values vs the package's own theme source.
 *
 * Run: node --test test/adversarial/catalog-fidelity.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const catalog = JSON.parse(readFileSync("catalog/catalog.json", "utf8"));
const repoPkg = JSON.parse(readFileSync("package.json", "utf8"));
const installedPkg = require("@aegov/design-system/package.json");
const plugin = require("@aegov/design-system/dist/plugin.js");

function extractAegovClasses(styles) {
  const found = new Set();
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) {
        for (const m of key.match(/\.aegov-[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []) found.add(m);
        walk(node[key]);
      }
    }
  })(styles);
  return found;
}

describe("catalogue ⇔ installed package fidelity", () => {
  test("version pin is coherent: package.json dep === installed === catalog meta === every component provenance", () => {
    assert.equal(repoPkg.dependencies["@aegov/design-system"], installedPkg.version);
    assert.equal(catalog.meta.generatedFrom.version, installedPkg.version);
    for (const c of catalog.components) {
      assert.equal(c.provenance.version, installedPkg.version, c.classRoot);
      assert.equal(c.provenance.tier, "package", c.classRoot);
    }
    for (const t of catalog.tokens) {
      assert.equal(t.provenance?.version, installedPkg.version, t.name);
      assert.equal(t.provenance?.tier, "package", t.name);
    }
  });

  test("catalogue class set EXACTLY equals a fresh introspection of dist/plugin.js", () => {
    const fresh = extractAegovClasses(plugin);
    const shipped = new Set(catalog.components.flatMap((c) => c.classes));
    const missingFromCatalog = [...fresh].filter((c) => !shipped.has(c)).sort();
    const phantomInCatalog = [...shipped].filter((c) => !fresh.has(c)).sort();
    assert.deepEqual(missingFromCatalog, [], "classes in the package the catalogue doesn't know");
    assert.deepEqual(phantomInCatalog, [], "classes the catalogue claims that don't ship");
    assert.equal(fresh.size, 41, "the documented 41 distinct .aegov-* classes");
    assert.equal(catalog.components.length, 27, "the documented 27 class-roots");
  });

  test("knownDocsOnlyClasses never overlap what actually ships, and are non-empty", () => {
    const fresh = extractAegovClasses(plugin);
    const drift = Object.keys(catalog.meta.knownDocsOnlyClasses ?? {});
    assert.ok(drift.length >= 5, `expected the 5+ documented drift classes, got ${drift.length}`);
    for (const cls of drift) {
      assert.ok(!fresh.has(`.${cls}`), `${cls} is listed docs-only but ships in the package`);
    }
  });

  test("raw palette color tokens match the package's own theme source values", () => {
    const colors = require("@aegov/design-system/src/theme/colors.js");
    // Flatten {aegold: {50: val}} -> --color-aegold-50
    const themeValues = new Map();
    (function flat(obj, prefix) {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object") flat(v, `${prefix}-${k}`);
        else themeValues.set(`${prefix}-${k}`, v);
      }
    })(colors, "--color");
    let compared = 0;
    for (const t of catalog.tokens) {
      if (t.category !== "color") continue;
      const themed = themeValues.get(t.name);
      if (themed !== undefined) {
        assert.equal(t.value, themed, `token ${t.name} diverges from the package theme`);
        compared++;
      }
    }
    assert.ok(compared >= 50, `expected to cross-check many palette tokens, compared only ${compared}`);
  });

  test("every docs-tier record in catalog.json carries sourceUrl + retrievedOn + contentHash + docsVersion", () => {
    const problems = [];
    (function walk(node, path) {
      if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (node && typeof node === "object") {
        if (node.tier === "docs") {
          for (const field of ["sourceUrl", "retrievedOn", "contentHash"]) {
            if (typeof node[field] !== "string" || !node[field]) problems.push(`${path}: missing ${field}`);
          }
          if (!("docsVersion" in node)) problems.push(`${path}: missing docsVersion`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(node.retrievedOn ?? "")) problems.push(`${path}: bad retrievedOn`);
        }
        for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
      }
    })(catalog, "$");
    assert.deepEqual(problems, []);
  });
});
