/**
 * Stage 2B step 5 — fill a COPY of TDRA's own assessment workbook with
 * Mizan's evidence, so the entity gets back the exact file a reviewer
 * expects, pre-filled where machines can speak.
 *
 * Layout verified against the real workbook (v2.0, "Ministry Checksheet"):
 * rows 1-5 entity metadata, row 8 header (A Sno# | B Category |
 * C Sub category | D Details | E Validate | F Reason), items from row 9.
 *
 * Honesty contract (STAGE2B-HANDOFF §3/§7):
 *  - column E "Validate" is the ENTITY's self-assessment — Mizan NEVER
 *    writes it, and never writes "Completed" anywhere;
 *  - column F "Reason" gets evidence: findings for flagged items, an
 *    explicit not-a-pass note for clean machine-checked items, "not checked
 *    this run" where the evidence engine didn't run, and "requires human
 *    answer" for the rest.
 *
 * Implementation note — why no xlsx library: the writer splices inline-string
 * cells into sheet1.xml and re-zips; every byte outside the spliced cells is
 * carried over UNTOUCHED, so TDRA's formatting cannot be mangled (a library
 * that re-serializes the workbook cannot promise that, and exceljs would add
 * a deprecated dependency tree to a pinned production CLI). The zip reader
 * mirrors scripts/extract-tdra-criteria.mjs, the committed faithful path.
 * TDRA's workbook itself is never redistributed: the template comes from
 * --xlsx-template, the local cache, or a fresh download at run time.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { AuditReport } from "./report.js";
import { loadTdraCriteria } from "./tdra.js";

const require = createRequire(import.meta.url);
const own = require("../../package.json") as { name: string; version: string };

export const CRITERIA_XLSX_URL =
  "https://designsystem.gov.ae/assets/files/tdra_dls-assessmentcriteria-2023_version2_0.xlsx";

/* ---------------------------------------------------------------- zip I/O */

type ZipEntry = { name: string; data: Buffer };

export function readZip(buf: Buffer): ZipEntry[] {
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
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("bad central-directory entry");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries.push({ name, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fixed DOS timestamp (2026-01-01 00:00) — deterministic output. */
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function writeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    locals.push(local, nameBuf, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(8, 10); // method
    central.writeUInt16LE(0, 12); // time
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // extra/comment/disk/attrs stay 0
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const centralStart = offset;
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

/* ------------------------------------------------------------ sheet edit */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // control chars are invalid in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

function xmlDecode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&amp;/g, "&");
}

function colOf(ref: string): string {
  return ref.replace(/\d+$/, "");
}

/** Column order: length first, then lexicographic ("Z" < "AA"). */
function colAfter(a: string, b: string): boolean {
  return a.length !== b.length ? a.length > b.length : a > b;
}

/**
 * Splice inline-string cells into a worksheet XML string. cellTexts maps a
 * full cell ref (e.g. "F10") to its new text. Existing cells at those refs
 * are replaced; new cells are inserted preserving column order.
 */
export function spliceCells(sheetXml: string, cellTexts: Map<string, string>): string {
  const byRow = new Map<number, Map<string, string>>();
  for (const [ref, text] of cellTexts) {
    const row = Number(ref.match(/\d+$/)![0]);
    if (!byRow.has(row)) byRow.set(row, new Map());
    byRow.get(row)!.set(ref, text);
  }
  return sheetXml.replace(
    /<row r="(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g,
    (whole, rowNumStr: string, attrs: string, closer: string, inner: string | undefined) => {
      const rowNum = Number(rowNumStr);
      const edits = byRow.get(rowNum);
      if (!edits) return whole;
      let cells = inner ?? "";
      for (const [ref, text] of edits) {
        const cellXml = `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
        const existing = new RegExp(`<c r="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`);
        if (existing.test(cells)) {
          cells = cells.replace(existing, cellXml);
          continue;
        }
        // insert before the first cell whose column sorts after ours
        const col = colOf(ref);
        let insertAt = cells.length;
        for (const m of cells.matchAll(/<c r="([A-Z]+\d+)"/g)) {
          if (colAfter(colOf(m[1]), col)) {
            insertAt = m.index!;
            break;
          }
        }
        cells = cells.slice(0, insertAt) + cellXml + cells.slice(insertAt);
      }
      return `<row r="${rowNum}"${attrs}>${cells}</row>`;
    },
  );
}

/** Parse shared strings (read path — same shape as the extract script). */
function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    xmlDecode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
}

/** row number → checklist item id, from column A of the item rows. */
export function itemRowMap(sheetXml: string, sharedStrings: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const rm of sheetXml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const a = rm[2].match(/<c r="A\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?/);
    if (!a || a[2] === undefined) continue;
    const value = a[1] === "s" ? sharedStrings[Number(a[2])] : a[2];
    if (/^\d+\.\d+$/.test(value.trim())) map.set(value.trim(), Number(rm[1]));
  }
  return map;
}

/* ------------------------------------------------------------- fill logic */

const CELL_TEXT_LIMIT = 1500; // keep Reason cells readable; full detail lives in report.md/json

function clip(s: string, max = CELL_TEXT_LIMIT): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** The Reason-column text for one checklist item. Never a pass claim. */
export function reasonText(report: AuditReport, itemId: string): string {
  const item = report.tdraChecklist.machineCheckedItems.find((i) => i.id === itemId);
  const tag = `Mizan ${own.version}`;
  if (!item) return `${tag}: requires human answer — outside the automated scope.`;
  if (item.status === "not-checked")
    return `${tag}: not checked in this run — its evidence engine did not run (e.g. needs --lighthouse, an http(s) target for origin/crawl probes, or --entity-type ministry).`;
  if (item.status === "no-automated-findings")
    return `${tag}: no automated findings in the machine-checkable subset — NOT a pass; human validation still required.`;
  const lines = item.findings.slice(0, 5).map((f) => `[${f.severity}] ${f.ruleId}: ${f.message}`);
  const more = item.findings.length > 5 ? ` (+${item.findings.length - 5} more — see report)` : "";
  return clip(`${tag}: ${item.findings.length} automated finding(s)${more}: ${lines.join(" | ")}`);
}

function bannerText(report: AuditReport): string {
  return (
    `Column F "Reason" pre-filled by ${own.name}@${own.version} (Mizan) on ` +
    `${report.generatedAt.slice(0, 10)} for ${report.target}. Community tool — NOT affiliated ` +
    `with or endorsed by TDRA. Automated checks cover a machine-checkable subset only; the ` +
    `"Validate" column is left entirely to the entity. Full evidence: report.md / report.json.`
  );
}

/** Resolve the workbook template: explicit path > local cache > fresh download. */
export async function resolveTemplate(explicitPath: string | null): Promise<Buffer> {
  if (explicitPath) return readFileSync(explicitPath);
  const here = dirname(fileURLToPath(import.meta.url));
  const cacheDir = join(here, "..", "..", ".tdra-cache");
  const cached = join(cacheDir, "tdra_dls-assessmentcriteria-2023_version2_0.xlsx");
  if (existsSync(cached)) return readFileSync(cached);
  console.error(`aegov-audit: downloading the TDRA workbook template from ${CRITERIA_XLSX_URL}`);
  const res = await fetch(CRITERIA_XLSX_URL);
  if (!res.ok) throw new Error(`template download failed: HTTP ${res.status} for ${CRITERIA_XLSX_URL}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cached, buf);
  return buf;
}

/**
 * Fill a copy of the TDRA workbook with the report's evidence and return the
 * finished xlsx bytes. Throws when the workbook's item rows do not match the
 * committed checklist (version drift — re-run tdra:fetch/extract and re-map).
 */
export function fillWorkbook(template: Buffer, report: AuditReport): Buffer {
  const entries = readZip(template);
  const sheetEntry = entries.find((e) => e.name === "xl/worksheets/sheet1.xml");
  const ssEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  if (!sheetEntry || !ssEntry) throw new Error("unexpected workbook shape: sheet1/sharedStrings missing");

  const sharedStrings = parseSharedStrings(ssEntry.data.toString("utf8"));
  const sheetXml = sheetEntry.data.toString("utf8");
  const rowsByItem = itemRowMap(sheetXml, sharedStrings);

  const criteria = loadTdraCriteria();
  const missing = criteria.items.filter((i) => !rowsByItem.has(i.id));
  if (missing.length)
    throw new Error(
      `workbook/checklist drift: ${missing.length} checklist item(s) not found in the workbook ` +
        `(first: ${missing[0]?.id}). The template may be a different version than the committed ` +
        `v${criteria.meta.version} extraction — re-verify with npm run tdra:fetch && tdra:extract.`,
    );

  const edits = new Map<string, string>();
  edits.set("H1", bannerText(report));
  for (const item of criteria.items) {
    edits.set(`F${rowsByItem.get(item.id)!}`, reasonText(report, item.id));
  }

  const guard = /completed/i;
  for (const [ref, text] of edits) {
    // Belt over braces: the writer must never emit a pass-sounding word on
    // its own behalf. ("not completed" would also match — keep wording clear
    // of the term entirely.)
    if (guard.test(text)) throw new Error(`refusing to write pass-adjacent wording into ${ref}: ${text}`);
  }

  const newSheet = Buffer.from(spliceCells(sheetXml, edits), "utf8");
  const outEntries = entries.map((e) =>
    e.name === "xl/worksheets/sheet1.xml" ? { name: e.name, data: newSheet } : e,
  );
  return writeZip(outEntries);
}
