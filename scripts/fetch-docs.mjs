// Snapshots the designsystem.gov.ae docs pages for the DOCS-SOURCED tier.
//
// Network happens ONLY here. Pages are saved verbatim to .docs-cache/ (gitignored)
// together with a manifest recording the canonical URL, HTTP status, byte size and
// retrieval date of every page. The extractor (extract-docs.mjs) then works purely
// offline from the cache, so extraction is deterministic given a snapshot.
//
// The page list is discovered from the live docs navigation (every docs page embeds
// the full sidebar), not hardcoded — a docs redesign shows up as a diff in the
// manifest rather than a silently stale list.
//
//   node scripts/fetch-docs.mjs
//
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const cacheDir = join(repoRoot, ".docs-cache");

const ORIGIN = "https://designsystem.gov.ae";
const SEED = `${ORIGIN}/docs/components/button`;
// Sections that carry catalogue content. Guide pages (installation etc.) are
// intentionally excluded — they document tooling, not components.
const SECTION_RE = /^\/docs\/(components|blocks|patterns)\/[a-z0-9-]+$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "dlsforge-aegov-mcp docs snapshot (github.com/dlsforge)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

console.log(`Discovering page list from ${SEED} ...`);
const seedHtml = await get(SEED);
const paths = [
  ...new Set(
    [...seedHtml.matchAll(/href="(\/docs\/[^"#?]+)"/g)]
      .map((m) => m[1].replace(/\/$/, ""))
      .filter((p) => SECTION_RE.test(p)),
  ),
].sort();

console.log(`Found ${paths.length} component/block/pattern pages.`);
mkdirSync(cacheDir, { recursive: true });

const retrievedOn = new Date().toISOString().slice(0, 10);
const manifest = { origin: ORIGIN, retrievedOn, pages: [] };

for (const path of paths) {
  const url = `${ORIGIN}${path}`;
  const [, section, slug] = path.match(/^\/docs\/([a-z]+)\/([a-z0-9-]+)$/);
  const file = `${section}--${slug}.html`;
  try {
    const html = await get(url);
    writeFileSync(join(cacheDir, file), html);
    manifest.pages.push({ section, slug, url, file, bytes: html.length, status: 200 });
    console.log(`  ok   ${path} (${html.length} bytes)`);
  } catch (err) {
    manifest.pages.push({ section, slug, url, file: null, bytes: 0, status: String(err.message) });
    console.error(`  FAIL ${path}: ${err.message}`);
  }
  await sleep(250); // be polite to a government site
}

writeFileSync(join(cacheDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const ok = manifest.pages.filter((p) => p.status === 200).length;
console.log(`\nSnapshot: ${ok}/${manifest.pages.length} pages ok, retrievedOn=${retrievedOn}`);
console.log(`Cache    : .docs-cache/ (gitignored; manifest.json records provenance)`);
if (ok !== manifest.pages.length) process.exitCode = 1;
