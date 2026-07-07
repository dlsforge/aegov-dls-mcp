// Lints the shipped catalogue artifacts (catalog/catalog.json + catalog/uaepass.json).
//
// The extract/build pipelines are deterministic — which means they reproduce
// their own parsing bugs perfectly, and contentHash only detects SOURCE drift,
// never a misreading by our extractor. Every text-corruption class found by
// hand so far (stray \r, undecoded entities, GitBook {% %} templating residue,
// orphan backslash escapes, silently dropped attachments) is encoded here as a
// permanent build-failing check, plus structural/cross-reference invariants
// and the high-stakes Emirates ID / UAE Pass guards.
//
// Scope: the two artifacts the server ships. Inventory files are inputs, not
// products — corruption there that matters flows into these and is caught here.
//
//   node scripts/validate-catalog.mjs
//
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const problems = [];
const bad = (file, path, message) => problems.push({ file, path, message });

// --- generic string lint -----------------------------------------------------------

// Field names whose values are code/markup (angle brackets etc. expected).
const CODE_KEYS = new Set(["html", "code"]);
// Field names whose values must be well-formed https URLs on trusted hosts.
const URL_KEYS = new Set(["url", "sourceUrl", "origin"]);
// OAuth2 endpoint fields live on the UAE Pass identity hosts, not the docs host.
const ENDPOINT_KEYS = new Set(["authorization", "token", "userInfo", "logout"]);
const TRUSTED_HOSTS = /^https:\/\/(designsystem\.gov\.ae|docs\.uaepass\.ae)([/?#]|$)/;
const UAEPASS_ID_HOSTS = /^https:\/\/(stg-)?id\.uaepass\.ae\//;

function lintString(file, path, key, value) {
  if (/\r/.test(value)) bad(file, path, "contains \\r (CRLF leak)");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))
    bad(file, path, "contains control characters");
  if (/&#x?[0-9a-z]+;|&#x[0-9a-z]+(?![0-9a-z;])/i.test(value))
    bad(file, path, `undecoded numeric entity: ${JSON.stringify(value.match(/&#x?[0-9a-z]*/i)?.[0])}`);
  if (/{%|%}/.test(value)) bad(file, path, "GitBook templating residue ({% ... %})");

  if (URL_KEYS.has(key)) {
    if (!TRUSTED_HOSTS.test(value)) bad(file, path, `URL not on a trusted source host: ${value}`);
    return;
  }
  if (ENDPOINT_KEYS.has(key)) {
    if (!UAEPASS_ID_HOSTS.test(value)) bad(file, path, `endpoint not on a uaepass.ae identity host: ${value}`);
    return;
  }
  if (CODE_KEYS.has(key)) return;

  // Plain-text fields: no leaked markup or markdown/escape residue. Bare tag
  // mentions like "<label>" are legitimate docs prose; a tag WITH attributes
  // is the signature of real markup leaking into a text field.
  if (/<[a-z][a-z0-9-]*\s+[^<>]*=/i.test(value))
    bad(file, path, `markup leaked into plain-text field: ${JSON.stringify(value.match(/<[a-z][^>]{0,60}/i)?.[0])}`);
  if (/\\[[\]_&"'“”]/.test(value)) bad(file, path, "orphan backslash escape (\\[ \\_ …)");
  if (/&(amp|lt|gt|quot|apos|nbsp);/.test(value)) bad(file, path, "undecoded named entity");
}

function walk(file, node, path, keyOfNode) {
  if (typeof node === "string") {
    lintString(file, path, keyOfNode, node);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => walk(file, v, `${path}[${i}]`, keyOfNode));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(file, v, `${path}.${k}`, k);
  }
}

// --- shared shape checks --------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RULE_KINDS = new Set(["accessibility", "usage", "rtl", "bilingual", "other"]);

function checkDocsProvenance(file, path, p) {
  if (p?.tier !== "docs") bad(file, path, `provenance.tier must be 'docs', got ${p?.tier}`);
  if (!TRUSTED_HOSTS.test(p?.sourceUrl ?? "")) bad(file, path, `bad sourceUrl: ${p?.sourceUrl}`);
  if (!ISO_DATE.test(p?.retrievedOn ?? "")) bad(file, path, `bad retrievedOn: ${p?.retrievedOn}`);
  if (!SHA256.test(p?.contentHash ?? "")) bad(file, path, "contentHash is not sha256 hex");
  if (!("docsVersion" in (p ?? {}))) bad(file, path, "missing docsVersion field");
}

function checkRule(file, path, r, { requireDocs = false } = {}) {
  if (!RULE_KINDS.has(r.kind)) bad(file, path, `unknown rule kind '${r.kind}'`);
  if (!r.statement?.trim()) bad(file, path, "empty rule statement");
  if (requireDocs || r.provenance?.tier === "docs") checkDocsProvenance(file, `${path}.provenance`, r.provenance);
}

// --- catalog.json ---------------------------------------------------------------------

function validateCatalog() {
  const file = "catalog/catalog.json";
  const cat = JSON.parse(readFileSync(join(repoRoot, "catalog", "catalog.json"), "utf8"));
  walk(file, cat, "$");

  if (cat.meta.schemaVersion !== 3) bad(file, "$.meta.schemaVersion", `expected 3, got ${cat.meta.schemaVersion}`);
  if (!cat.meta.generatedFrom?.version) bad(file, "$.meta.generatedFrom", "missing pinned version");

  const roots = cat.components.map((c) => c.classRoot);
  if (new Set(roots).size !== roots.length) bad(file, "$.components", "duplicate classRoots");

  const packageClasses = new Set();
  cat.components.forEach((c, i) => {
    const p = `$.components[${i}](${c.classRoot})`;
    if (!/^aegov-[a-z0-9-]+$/.test(c.classRoot)) bad(file, p, "classRoot is not an aegov-* slug");
    if (!c.classes.length) bad(file, p, "no member classes");
    c.classes.forEach((cls) => {
      if (!/^\.aegov-[a-z0-9-]+$/.test(cls)) bad(file, p, `member class '${cls}' not .aegov-*`);
      packageClasses.add(cls.replace(/^\./, ""));
    });
    if (c.provenance?.tier !== "package") bad(file, p, "component provenance must be package-tier");
    if (c.provenance?.version !== cat.meta.generatedFrom.version)
      bad(file, p, `provenance.version ${c.provenance?.version} != pinned ${cat.meta.generatedFrom.version}`);
    if (!SHA256.test(c.provenance?.contentHash ?? "")) bad(file, p, "contentHash is not sha256 hex");
    c.rules.forEach((r, j) => checkRule(file, `${p}.rules[${j}]`, r));
    [c.markup, ...c.examples].forEach((m, j) => {
      if (m) checkDocsProvenance(file, `${p}.markup/examples[${j}].provenance`, m.provenance);
    });
  });

  // knownDocsOnlyClasses: must exist, must never overlap what actually ships.
  const kdoc = cat.meta.knownDocsOnlyClasses ?? {};
  if (!Object.keys(kdoc).length) bad(file, "$.meta.knownDocsOnlyClasses", "missing/empty (validate_snippet depends on it)");
  for (const cls of Object.keys(kdoc)) {
    if (packageClasses.has(cls))
      bad(file, `$.meta.knownDocsOnlyClasses.${cls}`, "listed docs-only but ships in the package");
  }

  const artifacts = [...cat.blocks, ...cat.patterns, ...cat.docsOnlyComponents];
  const ids = artifacts.map((a) => a.id);
  if (new Set(ids).size !== ids.length) bad(file, "$.blocks/patterns/docsOnlyComponents", "duplicate artifact ids");
  const rootSet = new Set(roots);
  artifacts.forEach((a) => {
    const p = `$.artifact(${a.id})`;
    checkDocsProvenance(file, `${p}.provenance`, a.provenance);
    a.packageClassRoots.forEach((r) => {
      if (!rootSet.has(r)) bad(file, p, `packageClassRoots references unknown root '${r}'`);
    });
    a.rules.forEach((r, j) => checkRule(file, `${p}.rules[${j}]`, r));
  });

  // High-stakes: the Emirates ID pattern record must exist and keep its core content.
  const eid = cat.patterns.find((p) => p.id === "emirates-id-input");
  if (!eid) bad(file, "$.patterns", "emirates-id-input pattern record is missing");
  else {
    const text = eid.rules.map((r) => r.statement).join("\n");
    if (eid.rules.length < 2) bad(file, "$.patterns(emirates-id-input)", `expected >=2 rules, got ${eid.rules.length}`);
    if (!/784-/.test(text)) bad(file, "$.patterns(emirates-id-input)", "rules no longer mention the 784- format");
    if (!/mask/i.test(text)) bad(file, "$.patterns(emirates-id-input)", "rules no longer mention masking");
  }

  return cat;
}

// --- uaepass.json -----------------------------------------------------------------------

function validateUaePass() {
  const file = "catalog/uaepass.json";
  const up = JSON.parse(readFileSync(join(repoRoot, "catalog", "uaepass.json"), "utf8"));
  walk(file, up, "$");

  if (up.meta.schemaVersion !== 1) bad(file, "$.meta.schemaVersion", `expected 1, got ${up.meta.schemaVersion}`);
  if (!ISO_DATE.test(up.meta.retrievedOn ?? "")) bad(file, "$.meta.retrievedOn", "bad retrievedOn");

  // Endpoints: staging really staging, production really production.
  for (const env of ["staging", "production"]) {
    for (const key of ["authorization", "token", "userInfo", "logout"]) {
      const url = up.endpoints?.[env]?.[key];
      if (!url) bad(file, `$.endpoints.${env}.${key}`, "missing endpoint");
      else if (env === "staging" && !url.startsWith("https://stg-id.uaepass.ae/"))
        bad(file, `$.endpoints.${env}.${key}`, `staging endpoint not on stg-id.uaepass.ae: ${url}`);
      else if (env === "production" && !url.startsWith("https://id.uaepass.ae/"))
        bad(file, `$.endpoints.${env}.${key}`, `production endpoint not on id.uaepass.ae: ${url}`);
    }
  }
  checkDocsProvenance(file, "$.endpoints.provenance", up.endpoints?.provenance);

  const paramNames = (up.authorize?.params ?? []).map((p) => p.name);
  for (const required of ["response_type", "redirect_uri", "client_id", "state", "scope", "acr_values", "ui_locales"])
    if (!paramNames.includes(required)) bad(file, "$.authorize.params", `missing documented param '${required}'`);
  checkDocsProvenance(file, "$.authorize.provenance", up.authorize?.provenance);

  const variantIds = (up.buttonVariants ?? []).map((v) => v.id);
  if (new Set(variantIds).size !== variantIds.length) bad(file, "$.buttonVariants", "duplicate variant ids");
  for (const id of ["sign-in", "sign-up", "login", "continue", "sign"])
    if (!variantIds.includes(id)) bad(file, "$.buttonVariants", `missing variant '${id}'`);
  const appearanceIds = (up.appearances ?? []).map((a) => a.id).sort();
  if (JSON.stringify(appearanceIds) !== JSON.stringify(["black", "outline", "white"]))
    bad(file, "$.appearances", `expected black/outline/white, got ${appearanceIds}`);

  if (!/140pt/.test(up.minSize?.minWidth ?? "")) bad(file, "$.minSize.minWidth", "min width no longer 140pt");
  if (!/30pt/.test(up.minSize?.minHeight ?? "")) bad(file, "$.minSize.minHeight", "min height no longer 30pt");
  checkDocsProvenance(file, "$.minSize.provenance", up.minSize?.provenance);

  if (!(up.assets ?? []).length) bad(file, "$.assets", "no official asset downloads");
  up.assets.forEach((a, i) => checkDocsProvenance(file, `$.assets[${i}].provenance`, a.provenance));

  if (!(up.rules ?? []).length) bad(file, "$.rules", "no rules");
  up.rules.forEach((r, i) => {
    checkRule(file, `$.rules[${i}](${r.topic})`, r, { requireDocs: true });
    if (!r.topic?.trim()) bad(file, `$.rules[${i}]`, "empty topic");
  });
  // High-stakes wording rules the scaffolder's guidance depends on.
  const topics = up.rules.map((r) => r.topic);
  for (const t of ["Logo and Title Colors", "Button Size and Margin", "Powered by UAE PASS"])
    if (!topics.includes(t)) bad(file, "$.rules", `high-stakes rule topic '${t}' is missing`);

  return up;
}

// --- run ----------------------------------------------------------------------------------

const cat = validateCatalog();
const up = validateUaePass();

if (problems.length) {
  console.error(`validate-catalog: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p.file}  ${p.path}\n    ${p.message}`);
  process.exit(1);
}
console.log(
  `validate-catalog: OK — catalog.json (${cat.components.length} components, ${cat.tokens.length} tokens, ` +
    `${cat.blocks.length}/${cat.patterns.length}/${cat.docsOnlyComponents.length} docs artifacts) and ` +
    `uaepass.json (${up.rules.length} rules, ${up.assets.length} assets) pass all lint + invariant checks`,
);
