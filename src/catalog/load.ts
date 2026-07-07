/**
 * Loads the generated catalogue. The JSON ships inside the npm package
 * (package.json `files` includes `catalog/`), resolved relative to this
 * module so it works from dist/ in both the repo and the installed package.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Catalog } from "./types.js";

export function loadCatalog(): Catalog {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "catalog", "catalog.json");
  return JSON.parse(readFileSync(path, "utf8")) as Catalog;
}
