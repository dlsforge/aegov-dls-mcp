// Extracts the TDRA assessment-criteria workbook (fetched by
// fetch-tdra-criteria.mjs) into reference/tdra-assessment-criteria.json —
// the committed, faithful record Mizan's report layer mirrors.
//
// FAITHFUL means faithful: questions are extracted verbatim, no
// interpretation. The mapping of checklist items to Mizan's automated checks
// lives in the report layer (step 5), not here.
//
// The Lighthouse/LCP/FCP thresholds do NOT appear inside the workbook — they
// are stated on the assessment-criteria web page. They are recorded here in
// meta.pageStatedThresholds with their own provenance, verified manually
// against the live page (see retrievedOn).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const cacheDir = join(pkgRoot, ".tdra-cache");
const xlsx = join(cacheDir, "tdra_dls-assessmentcriteria-2023_version2_0.xlsx");
if (!existsSync(xlsx)) {
  console.error("extract-tdra-criteria: run fetch-tdra-criteria.mjs first (no cached workbook)");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(cacheDir, "manifest.json"), "utf8"));

// xlsx = zip. Read it in pure Node (central directory + inflateRawSync) so
// the script runs identically on Windows and CI — no external unzip/tar.
function readZipEntries(buf) {
  // End-of-central-directory record: PK\x05\x06, scan back past any comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip: no end-of-central-directory record");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("bad central-directory entry");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    // Local header repeats name/extra lengths; data follows them.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    entries.set(name, method === 8 ? () => inflateRawSync(data) : () => Buffer.from(data));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

{
  const zip = readZipEntries(readFileSync(xlsx));
  const fileText = (name) => {
    const get = zip.get(name);
    if (!get) throw new Error(`missing ${name} in workbook`);
    return get().toString("utf8");
  };

  const decode = (s) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));

  const ss = fileText("xl/sharedStrings.xml");
  const strings = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );

  const sheet = fileText("xl/worksheets/sheet1.xml");
  const rows = [];
  for (const rm of sheet.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cm of rm[2].matchAll(
      /<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?/g,
    )) {
      const [, col, type, val] = cm;
      if (val === undefined) continue;
      cells[col] = type === "s" ? strings[Number(val)] : val;
    }
    if (Object.keys(cells).length) rows.push({ row: Number(rm[1]), cells });
  }

  const sections = [];
  const items = [];
  let currentSection = null;
  for (const r of rows) {
    const a = (r.cells.A ?? "").trim();
    if (/^SECTION\s/i.test(a)) {
      currentSection = a;
      sections.push(a);
    } else if (/^\d+\.\d+$/.test(a) && currentSection) {
      items.push({
        id: a,
        section: currentSection,
        category: (r.cells.B ?? "").trim() || null,
        subCategory: (r.cells.C ?? "").trim() || null,
        question: (r.cells.D ?? "").trim(),
      });
    }
  }

  const out = {
    meta: {
      title: "TDRA DLS Assessment Criteria",
      version: "2.0",
      published: "2023-09-26",
      provenance: {
        tier: "docs",
        sourceUrl: manifest.url,
        pageUrl: manifest.pageUrl,
        retrievedOn: manifest.retrievedOn,
        trust:
          "docs-sourced from designsystem.gov.ae — provisional, needs revalidation " +
          "against the live page before each release; TDRA updates the checklist " +
          "with design-system releases",
      },
      // Stated on the assessment-criteria PAGE (not inside the workbook):
      pageStatedThresholds: {
        lighthouse: {
          accessibility: ">=90",
          performance: ">=90",
          seo: ">=90",
          bestPractices: ">=80 (preferably >=90)",
          formFactors: ["desktop", "mobile"],
        },
        loadTime: { largestContentfulPaint: "<=2.5s", firstContentfulPaint: "<=1.8s" },
        provenance: {
          tier: "docs",
          sourceUrl: manifest.pageUrl,
          retrievedOn: manifest.retrievedOn,
        },
      },
      // The workbook's own accessibility baseline (item 3.12) is WCAG 2.1 AA.
      wcagBaseline: "WCAG 2.1 AA (workbook item 3.12)",
    },
    sections,
    items,
  };

  mkdirSync(join(pkgRoot, "reference"), { recursive: true });
  const outPath = join(pkgRoot, "reference", "tdra-assessment-criteria.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `extracted ${items.length} items across ${sections.length} sections -> ${outPath}`,
  );
  if (items.length !== 125)
    console.warn(`NOTE: expected 125 items from v2.0; got ${items.length} — re-verify.`);
}
