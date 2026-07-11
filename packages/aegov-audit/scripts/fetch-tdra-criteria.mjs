// Downloads the official TDRA assessment-criteria workbook into .tdra-cache/
// (gitignored — the committed record is reference/tdra-assessment-criteria.json,
// produced by extract-tdra-criteria.mjs). Mirrors Stage 1's fetch/extract
// pattern: fetch is repeatable, the extraction is the faithful record.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const cacheDir = join(pkgRoot, ".tdra-cache");

export const CRITERIA_XLSX_URL =
  "https://designsystem.gov.ae/assets/files/tdra_dls-assessmentcriteria-2023_version2_0.xlsx";
export const CRITERIA_PAGE_URL = "https://designsystem.gov.ae/resources/assessment-criteria";

const res = await fetch(CRITERIA_XLSX_URL);
if (!res.ok) {
  console.error(`fetch-tdra-criteria: ${res.status} ${res.statusText} for ${CRITERIA_XLSX_URL}`);
  process.exit(1);
}
mkdirSync(cacheDir, { recursive: true });
const buf = Buffer.from(await res.arrayBuffer());
const out = join(cacheDir, "tdra_dls-assessmentcriteria-2023_version2_0.xlsx");
writeFileSync(out, buf);
writeFileSync(
  join(cacheDir, "manifest.json"),
  JSON.stringify(
    { url: CRITERIA_XLSX_URL, pageUrl: CRITERIA_PAGE_URL, retrievedOn: new Date().toISOString().slice(0, 10), bytes: buf.length },
    null,
    2,
  ) + "\n",
);
console.log(`fetched ${buf.length} bytes -> ${out}`);
