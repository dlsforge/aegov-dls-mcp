// Snapshots the docs.uaepass.ae developer-guideline pages for the DOCS-SOURCED tier
// of the UAE Pass scaffolder (STAGE1-HANDOFF.md §10.6: docs.uaepass.ae confirmed
// canonical by Alam).
//
// Network happens ONLY here. Pages are saved verbatim to .uaepass-cache/ (gitignored)
// together with a manifest recording the canonical URL, HTTP status, byte size and
// retrieval date of every page. The extractor (extract-uaepass.mjs) then works purely
// offline from the cache, so extraction is deterministic given a snapshot.
//
// The page list is discovered from the site's published llms.txt index (every page is
// served as raw markdown at `<path>.md`), filtered to the two sections that source the
// scaffolder: design guidelines (button variants, states, dos-and-donts) and the
// web-application authentication feature guide (OAuth2 flow, endpoints, login button).
//
//   node scripts/fetch-uaepass.mjs
//
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const cacheDir = join(repoRoot, ".uaepass-cache");

const ORIGIN = "https://docs.uaepass.ae";
// Sections that source the scaffolder. Everything else in llms.txt (mobile SDKs,
// digital signatures, verification…) is out of scope for scaffoldUaePass v1.
const SECTION_RE =
  /^\/(guidelines\/design-guidelines|feature-guides\/authentication\/web-application)(\/|$)/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "dlsforge-aegov-mcp docs snapshot (github.com/dlsforge)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

console.log(`Discovering page list from ${ORIGIN}/llms.txt ...`);
const llmsTxt = await get(`${ORIGIN}/llms.txt`);
const paths = [
  ...new Set(
    [...llmsTxt.matchAll(/https:\/\/docs\.uaepass\.ae(\/[^\s)]+?)\.md\b/g)]
      .map((m) => m[1])
      .filter((p) => SECTION_RE.test(p)),
  ),
].sort();

console.log(`Found ${paths.length} in-scope pages (design guidelines + web auth).`);
mkdirSync(cacheDir, { recursive: true });

const retrievedOn = new Date().toISOString().slice(0, 10);
const manifest = { origin: ORIGIN, retrievedOn, pages: [] };

for (const path of paths) {
  // Page identity is the canonical HTML URL; we fetch its raw-markdown twin.
  const url = `${ORIGIN}${path}`;
  const slug = path.replace(/^\//, "").replace(/\//g, "--");
  const file = `${slug}.md`;
  try {
    const md = await get(`${url}.md`);
    writeFileSync(join(cacheDir, file), md);
    manifest.pages.push({ path, url, file, bytes: md.length, status: 200 });
    console.log(`  ok   ${path} (${md.length} bytes)`);
  } catch (err) {
    manifest.pages.push({ path, url, file: null, bytes: 0, status: String(err.message) });
    console.error(`  FAIL ${path}: ${err.message}`);
  }
  await sleep(250); // be polite to a government site
}

writeFileSync(join(cacheDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const ok = manifest.pages.filter((p) => p.status === 200).length;
console.log(`\nSnapshot: ${ok}/${manifest.pages.length} pages ok, retrievedOn=${retrievedOn}`);
console.log(`Cache    : .uaepass-cache/ (gitignored; manifest.json records provenance)`);
if (ok !== manifest.pages.length) process.exitCode = 1;
