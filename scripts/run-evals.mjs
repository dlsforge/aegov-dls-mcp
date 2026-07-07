// Eval judge (build step 6) — verifies assistant-generated screens against the
// spec checks in evals/screens/*.json.
//
// End-to-end honest: boots the REAL MCP server over stdio (the same machinery
// an AI assistant embeds) and runs every output through validate_snippet first
// — an output with class/structure errors fails before any spec check runs.
// Then applies the spec's structural requirements (required class roots,
// required/forbidden patterns, document lang, RTL).
//
// The generation rule (evals/README.md): outputs are produced by an assistant
// from the spec `prompt` alone. NEVER hand-edit an output to make this judge
// pass — fix the catalogue / tool descriptions and regenerate.
//
//   npm run evals            (all screens)
//   node scripts/run-evals.mjs 02 09   (subset by id prefix)
//
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const screensDir = join(repoRoot, "evals", "screens");
const outputsDir = join(repoRoot, "evals", "outputs");

const only = process.argv.slice(2);
const specs = readdirSync(screensDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(screensDir, f), "utf8")))
  .filter((s) => !only.length || only.some((o) => s.id.startsWith(o)))
  .sort((a, b) => (a.id < b.id ? -1 : 1));

if (!specs.length) {
  console.error("No matching eval specs.");
  process.exit(1);
}

// --- boot the real server ------------------------------------------------------

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(repoRoot, "dist", "index.js")],
});
const client = new Client({ name: "eval-judge", version: "0.0.1" });
await client.connect(transport);

async function validateSnippet(html) {
  const res = await client.callTool({ name: "validate_snippet", arguments: { html } });
  return JSON.parse(res.content?.[0]?.text ?? "null");
}

// --- checks ---------------------------------------------------------------------

const CLASS_ATTR_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function classTokens(html) {
  const out = new Set();
  for (const m of html.matchAll(CLASS_ATTR_RE))
    for (const t of (m[1] ?? m[2]).split(/\s+/)) if (t) out.add(t);
  return out;
}

async function judge(spec) {
  const failures = [];
  const warnings = [];
  const file = join(outputsDir, `${spec.id}.html`);

  if (!existsSync(file)) return { failures: ["no output file — generate it first"], warnings };
  const html = readFileSync(file, "utf8");
  if (html.trim().length < 500) failures.push("output implausibly small (<500 bytes)");

  // Gate 1: the server's own validator. Errors fail; warnings are surfaced.
  const v = await validateSnippet(html);
  for (const f of v.findings ?? []) {
    if (f.level === "error") failures.push(`validate_snippet: ${f.message}`);
    else if (f.level === "warning") warnings.push(`validate_snippet: ${f.message}`);
  }

  // Gate 2: spec structure.
  const tokens = classTokens(html);
  for (const root of spec.checks.requiredClassRoots ?? []) {
    const hit = [...tokens].some((t) => t === root || t.startsWith(`${root}-`));
    if (!hit) failures.push(`missing required component: no ${root}* class in the page`);
  }
  for (const p of spec.checks.requiredPatterns ?? []) {
    if (!new RegExp(p.pattern, p.flags).test(html))
      failures.push(`missing: ${p.why} (/${p.pattern}/${p.flags})`);
  }
  for (const p of spec.checks.forbiddenPatterns ?? []) {
    if (new RegExp(p.pattern, p.flags).test(html))
      failures.push(`forbidden: ${p.why} (/${p.pattern}/${p.flags})`);
  }
  if (spec.checks.documentLang && !/<html[^>]*\slang=/i.test(html))
    failures.push("missing lang attribute on <html>");
  if (spec.checks.rtl && !/<html[^>]*\sdir="rtl"/i.test(html))
    failures.push('missing dir="rtl" on <html>');

  return { failures, warnings };
}

// --- run -------------------------------------------------------------------------

let passed = 0;
const lines = [];
for (const spec of specs) {
  const { failures, warnings } = await judge(spec);
  const ok = failures.length === 0;
  if (ok) passed++;
  lines.push(`${ok ? "PASS" : "FAIL"}  ${spec.id}  ${spec.name}`);
  for (const f of failures) lines.push(`      ✗ ${f}`);
  for (const w of warnings) lines.push(`      ⚠ ${w}`);
}
await client.close();

console.log(lines.join("\n"));
console.log(`\n${passed}/${specs.length} screens pass`);
process.exit(passed === specs.length ? 0 : 1);
