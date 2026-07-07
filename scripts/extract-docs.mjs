// Extracts the DOCS-SOURCED tier from the .docs-cache/ snapshot into
// inventory/docs.json — the faithful, committed record of what the docs said.
//
// Works entirely OFFLINE from the cache written by fetch-docs.mjs; given the same
// snapshot, output is byte-identical (retrievedOn comes from the manifest, never
// from the clock). Selection/mapping into catalogue records happens downstream in
// build-catalog.mjs — this script records, it does not interpret.
//
// Per page it captures:
//   - the docs display name (h1) and the version string the page exposes (<title>)
//   - every h2/h3 section: heading, id, plain text, and code blocks (unescaped)
//   - every `aegov-*` class token used in HTML code examples (drift raw material)
//   - a sha256 content hash over the normalized extraction (name + sections),
//     NOT raw page HTML, so cosmetic page churn does not read as content drift
//
//   node scripts/extract-docs.mjs
//
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const cacheDir = join(repoRoot, ".docs-cache");

const manifest = JSON.parse(readFileSync(join(cacheDir, "manifest.json"), "utf8"));

// --- small HTML helpers (the docs are regular enough that a parser dependency
// --- is not warranted; if a future redesign breaks these, revisit that call) ---

function unescapeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Tag matcher that survives `>` inside quoted attribute values — the docs use
 * Tailwind arbitrary variants like class="[&>li]:leading-normal", on which a
 * naive /<[^>]+>/ stops early and leaks attribute debris into the text.
 */
const TAG_RE = /<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|<!--[\s\S]*?-->/g;

/** Strip tags from an HTML slice and normalize whitespace to single spaces. */
function textOf(htmlSlice) {
  return unescapeEntities(
    htmlSlice
      .replace(/<pre[\s\S]*?<\/pre>/g, " ") // code is captured separately
      .replace(TAG_RE, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove live visual-demo tab panels. Docs pages render each example three ways
 * in `tab-content` panels: a live visual demo, an HTML listing, a React listing.
 * The listings carry `<pre>`; the visual demo is real rendered markup — with its
 * own headings and labels (the header block demo embeds a full mega-menu with
 * `<h2>Service category</h2>` etc.), which would pollute section splitting and
 * section text. Panels WITHOUT `<pre>` are the visual demos; excise them.
 * (Panel id naming varies across pages — body-item1-visual, v1-item1-body — so
 * this keys on structure, not ids.)
 */
function stripVisualTabPanels(html) {
  const OPEN_RE = /<div[^>]*\btab-content\b[^>]*>/g;
  let out = "";
  let cursor = 0;
  for (const m of html.matchAll(OPEN_RE)) {
    if (m.index < cursor) continue; // inside an already-excised panel
    // Find the matching </div> by depth-counting.
    const scan = /<\/?div\b/g;
    scan.lastIndex = m.index + m[0].length;
    let depth = 1;
    let end = html.length;
    let t;
    while (depth > 0 && (t = scan.exec(html))) {
      depth += t[0] === "<div" ? 1 : -1;
      if (depth === 0) end = html.indexOf(">", t.index) + 1;
    }
    const body = html.slice(m.index, end);
    if (!body.includes("<pre")) {
      out += html.slice(cursor, m.index);
      cursor = end;
    }
  }
  return out + html.slice(cursor);
}

const CODE_RE = /<pre[^>]*><code class="language-([a-z]+)">([\s\S]*?)<\/code><\/pre>/g;
const HEADING_RE = /<h([23])[^>]*?(?:\bid="([^"]*)")?[^>]*>([\s\S]*?)<\/h\1>/g;
const CLASS_ATTR_RE = /\bclass=(?:"([^"]*)"|'([^']*)')/g;

/**
 * aegov-* tokens used as CSS CLASSES in a code example. Only `class` attribute
 * values count — the docs also use aegov-* strings as element ids for ARIA
 * wiring (e.g. id="aegov-accordion-head-1"), which are not classes.
 */
function aegovClassesIn(code) {
  const out = [];
  for (const m of code.matchAll(CLASS_ATTR_RE)) {
    for (const token of (m[1] ?? m[2]).split(/\s+/)) {
      if (/^aegov-[a-z0-9-]+$/.test(token)) out.push(token);
    }
  }
  return out;
}

function codeBlocksOf(htmlSlice) {
  const blocks = [];
  for (const m of htmlSlice.matchAll(CODE_RE)) {
    blocks.push({ language: m[1], code: unescapeEntities(m[2]).trim() });
  }
  return blocks;
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

// --- per-page extraction -------------------------------------------------------

function extractPage(rawHtml, page) {
  const html = stripVisualTabPanels(rawHtml);
  const titleTag = html.match(/<title>([\s\S]*?)<\/title>/)?.[1].trim() ?? null;
  const docsVersion =
    titleTag?.match(/UAE design system ([\d.]+)/i)?.[1] ?? null;

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const name = h1 ? textOf(h1[1]) : page.slug;
  const contentStart = h1 ? h1.index : 0;

  // Content ends where the previous/next pager begins (the pager has no h2/h3,
  // so without this cut its link text would bleed into the last section).
  // Cut at the START of the label's enclosing <div> — the marker sits mid-tag,
  // and cutting there would leave an unclosed `<div class="font-bold...`
  // fragment that the tag-stripper cannot remove.
  const pagerAt = html.indexOf('text-base mb-1">Previous</div>', contentStart);
  const nextAt = html.indexOf('text-base mb-1">Next</div>', contentStart);
  const cuts = [pagerAt, nextAt].filter((i) => i !== -1);
  const contentEnd = cuts.length
    ? html.lastIndexOf("<div", Math.min(...cuts))
    : html.length;
  const content = html.slice(contentStart, contentEnd);

  // Split into sections on h2/h3 boundaries. The h1 intro (before the first
  // h2/h3) becomes a synthetic "intro" section when it carries text.
  const headings = [...content.matchAll(HEADING_RE)].map((m) => ({
    level: Number(m[1]),
    id: m[2] ?? null,
    heading: textOf(m[3]),
    start: m.index,
    bodyStart: m.index + m[0].length,
  }));

  const sections = [];
  const introSlice = content.slice(0, headings.length ? headings[0].start : content.length);
  const introText = textOf(introSlice.replace(/<h1[\s\S]*?<\/h1>/, " "));
  if (introText) {
    sections.push({
      id: null,
      level: 1,
      heading: "intro",
      text: introText,
      codeBlocks: codeBlocksOf(introSlice),
    });
  }
  headings.forEach((h, i) => {
    const slice = content.slice(h.bodyStart, i + 1 < headings.length ? headings[i + 1].start : content.length);
    sections.push({
      id: h.id,
      level: h.level,
      heading: h.heading,
      text: textOf(slice),
      codeBlocks: codeBlocksOf(slice),
    });
  });

  // Every aegov-* class used in HTML code examples (sorted, distinct).
  const aegovClasses = [
    ...new Set(
      sections
        .flatMap((s) => s.codeBlocks)
        .filter((b) => b.language === "html")
        .flatMap((b) => aegovClassesIn(b.code)),
    ),
  ].sort();

  const record = {
    section: page.section,
    slug: page.slug,
    url: page.url,
    retrievedOn: manifest.retrievedOn,
    name,
    docsVersion,
    sections,
    aegovClassesInExamples: aegovClasses,
  };
  record.contentHash = sha256(
    JSON.stringify(normalize({ name, docsVersion, sections })),
  );
  return record;
}

// --- run -------------------------------------------------------------------------

const pages = manifest.pages
  .filter((p) => p.status === 200)
  .map((p) => extractPage(readFileSync(join(cacheDir, p.file), "utf8"), p));

const out = {
  origin: manifest.origin,
  retrievedOn: manifest.retrievedOn,
  pages,
};

const outPath = join(repoRoot, "inventory", "docs.json");
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

const bySection = pages.reduce((acc, p) => {
  acc[p.section] = (acc[p.section] || 0) + 1;
  return acc;
}, {});
const codeCount = pages.reduce(
  (n, p) => n + p.sections.reduce((m, s) => m + s.codeBlocks.length, 0),
  0,
);
console.log(`Pages     : ${pages.length} ${JSON.stringify(bySection)}`);
console.log(`Sections  : ${pages.reduce((n, p) => n + p.sections.length, 0)}`);
console.log(`Code blocks: ${codeCount}`);
console.log(
  `Docs versions seen: ${JSON.stringify([...new Set(pages.map((p) => p.docsVersion))])}`,
);
console.log(`Written   : inventory/docs.json`);
