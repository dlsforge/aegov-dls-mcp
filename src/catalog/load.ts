/**
 * Loads the generated catalogue. The JSON ships inside the npm package
 * (package.json `files` includes `catalog/`), resolved relative to this
 * module so it works from dist/ in both the repo and the installed package.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Catalog, UaePassGuidance } from "./types.js";

function loadJson(name: string) {
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(here, "..", "..", "catalog", name), "utf8"));
}

export function loadCatalog(): Catalog {
  return loadJson("catalog.json") as Catalog;
}

export function loadUaePass(): UaePassGuidance {
  return loadJson("uaepass.json") as UaePassGuidance;
}
