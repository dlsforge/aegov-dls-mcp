// Extracts the docs.uaepass.ae snapshot into inventory/uaepass.json — the
// faithful, committed record of what the UAE Pass developer docs said.
//
// Works entirely OFFLINE from the cache written by fetch-uaepass.mjs; given the
// same snapshot, output is byte-identical (retrievedOn comes from the manifest,
// never from the clock). Selection/curation into scaffolder guidance happens
// downstream in build-uaepass.mjs — this script records, it does not interpret.
//
// The cache is raw GitBook markdown (the site serves every page as `<path>.md`).
// Per page it captures:
//   - the display name (h1)
//   - every heading-delimited section: heading, level, plain text, code blocks,
//     and parsed markdown tables (endpoints/params/size specs live in tables)
//   - downloadable file attachments ({% file %} blocks) and figure images —
//     the official button artwork ships as files, not as text
//   - a sha256 content hash over the normalized extraction, NOT raw markdown,
//     so cosmetic page churn does not read as content drift
//
//   node scripts/extract-uaepass.mjs
//
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const cacheDir = join(repoRoot, ".uaepass-cache");

const manifest = JSON.parse(readFileSync(join(cacheDir, "manifest.json"), "utf8"));

// --- markdown helpers ------------------------------------------------------------

/** Decode the HTML entities GitBook leaves in exported markdown. */
function decodeEntities(s) {
  return s
    .replace(/&#x20;/g, " ")
    .replace(/&#xNAN;/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Reduce a markdown slice to plain guidance text: drop code fences, figures,
 * GitBook templating ({% file %}, {% hint %}, {% tabs %}, <mark>), images and
 * table rows (tables are parsed separately), unwrap emphasis/links, and
 * normalize whitespace. Bullet items keep a leading "- " so list structure
 * survives as readable text.
 */
function textOf(mdSlice) {
  const lines = [];
  let inFence = false;
  for (const raw of mdSlice.split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^\s*\|/.test(line)) continue; // table rows are parsed separately
    if (/^\s*{%\s*(end)?(file|hint|tab|tabs)/.test(line)) continue;
    if (/^\s*<figure>/.test(line) || /^\s*!\[/.test(line)) continue;
    lines.push(line.replace(/^(\s*)[*+-]\s+/, "$1- "));
  }
  return decodeEntities(lines.join("\n"))
    .replace(/<[^>\n]+>/g, " ") // stray inline HTML (<mark>, <br>, <p>)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*\n]*)\*/g, "$1")
    .replace(/\\$/gm, "") // GitBook hard-break backslashes
    .replace(/\\([&_[\]“”"'])/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse markdown pipe-tables in a slice into arrays of cell rows. */
function tablesOf(mdSlice) {
  const tables = [];
  let current = null;
  for (const raw of mdSlice.split("\n")) {
    const line = raw.trim();
    if (/^\|.*\|$/.test(line)) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // separator row
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => decodeEntities(c.trim()).replace(/^`(.*)`$/, "$1").replace(/<[^>\n]+>/g, " ").replace(/\s+/g, " ").trim());
      (current ??= []).push(cells);
    } else if (current) {
      tables.push(current);
      current = null;
    }
  }
  if (current) tables.push(current);
  return tables;
}

const FENCE_RE = /^```([a-z]*)\s*$([\s\S]*?)^```\s*$/gm;

function codeBlocksOf(mdSlice) {
  const blocks = [];
  for (const m of mdSlice.matchAll(FENCE_RE)) {
    const code = decodeEntities(m[2]).trim();
    if (code) blocks.push({ language: m[1] || null, code });
  }
  return blocks;
}

/**
 * {% file src="/files/x" %} attachments — with a label body and {% endfile %},
 * or self-closing (the button-assets page uses the bare form).
 */
function filesOf(md, origin) {
  const out = [];
  for (const m of md.matchAll(
    /{%\s*file\s+src="([^"]+)"\s*%}(?:([\s\S]*?){%\s*endfile\s*%})?/g,
  )) {
    out.push({
      url: origin + m[1].replace(/\\_/g, "_"),
      label: m[2] ? textOf(m[2]).replace(/\n+/g, " ").trim() || null : null,
    });
  }
  return out;
}

/**
 * Figure/inline images — the visual specs live in these. Figcaptions are real
 * guidance text on otherwise image-only pages, so they are captured alongside.
 */
function imagesOf(md, origin) {
  const byUrl = new Map();
  for (const m of md.matchAll(
    /<figure><img src="(\/files\/[^"]+)"[^>]*>(?:<figcaption>([\s\S]*?)<\/figcaption>)?<\/figure>/g,
  )) {
    const caption = m[2] ? textOf(m[2].replace(/<[^>]+>/g, " ")).replace(/\n+/g, " ").trim() : "";
    byUrl.set(origin + m[1], { url: origin + m[1], caption: caption || null });
  }
  for (const m of md.matchAll(/!\[([^\]]*)\]\((\/files\/[^)]+)\)/g)) {
    if (!byUrl.has(origin + m[2]))
      byUrl.set(origin + m[2], { url: origin + m[2], caption: m[1].trim() || null });
  }
  return [...byUrl.values()];
}

function sha256(str) {
  return createHash("sha256").update(str).digest("hex");
}

/** Recursively sort object keys so hashing is stable. */
function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node).sort()) out[k] = normalize(node[k]);
    return out;
  }
  return node;
}

// --- per-page extraction -----------------------------------------------------------

function extractPage(rawMd, page) {
  // Normalize line endings, then drop the boilerplate llms.txt blockquote
  // header every page starts with. (Some pages carry bare \r mid-content,
  // which would otherwise leak into extracted text.)
  const md = rawMd.replace(/\r\n?/g, "\n").replace(/^(>[^\n]*\n)+\n?/, "");

  const h1 = md.match(/^# (.+)$/m);
  const name = h1 ? decodeEntities(h1[1]).trim() : page.path.split("/").pop();
  const content = h1 ? md.slice(h1.index + h1[0].length) : md;

  // Split into sections on heading boundaries (##..####). The h1 body before
  // the first subheading becomes a synthetic "intro" section when non-empty.
  const headings = [...content.matchAll(/^(#{2,4}) (.+)$/gm)].map((m) => ({
    level: m[1].length,
    heading: decodeEntities(m[2]).replace(/[*_`]/g, "").trim(),
    start: m.index,
    bodyStart: m.index + m[0].length,
  }));

  const sections = [];
  const pushSection = (level, heading, slice) => {
    const text = textOf(slice);
    const codeBlocks = codeBlocksOf(slice);
    const tables = tablesOf(slice);
    if (text || codeBlocks.length || tables.length) {
      sections.push({ level, heading, text, codeBlocks, tables });
    }
  };
  pushSection(1, "intro", content.slice(0, headings.length ? headings[0].start : content.length));
  headings.forEach((h, i) => {
    const end = i + 1 < headings.length ? headings[i + 1].start : content.length;
    pushSection(h.level, h.heading, content.slice(h.bodyStart, end));
  });

  const record = {
    path: page.path,
    url: page.url,
    retrievedOn: manifest.retrievedOn,
    name,
    sections,
    files: filesOf(content, manifest.origin),
    images: imagesOf(content, manifest.origin),
  };
  record.contentHash = sha256(
    JSON.stringify(
      normalize({ name, sections: record.sections, files: record.files, images: record.images }),
    ),
  );
  return record;
}

// --- run ---------------------------------------------------------------------------

const pages = manifest.pages
  .filter((p) => p.status === 200)
  .map((p) => extractPage(readFileSync(join(cacheDir, p.file), "utf8"), p));

const out = {
  origin: manifest.origin,
  retrievedOn: manifest.retrievedOn,
  pages,
};

const outPath = join(repoRoot, "inventory", "uaepass.json");
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

const sectionCount = pages.reduce((n, p) => n + p.sections.length, 0);
const tableCount = pages.reduce((n, p) => n + p.sections.reduce((m, s) => m + s.tables.length, 0), 0);
const fileCount = pages.reduce((n, p) => n + p.files.length, 0);
console.log(`Pages    : ${pages.length}`);
console.log(`Sections : ${sectionCount}, tables: ${tableCount}, file attachments: ${fileCount}`);
console.log(`Written  : inventory/uaepass.json`);
