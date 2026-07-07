// Builds catalog/uaepass.json — the curated UAE Pass guidance the scaffolder
// serves — from the faithful record in inventory/uaepass.json.
//
// This is the INTERPRETING layer (the extract script records verbatim). All
// interpretation is a reviewed mapping declared below, in the spirit of
// inventory/docs-map.json:
//   - RULE_PAGES maps each guideline page to a rule kind; the rule statement is
//     the page's extracted text VERBATIM — never paraphrased.
//   - Structured facts (endpoints, authorize params, minimum size) are parsed
//     mechanically from the pages' markdown tables, with assertions so silent
//     table drift breaks the build instead of shipping wrong endpoints.
//   - OUT_OF_SCOPE acknowledges every page deliberately not consumed (v1 scope:
//     the login-button scaffolder; account linking, error messages, SMS
//     guidelines and the post-authorize OAuth steps are not scaffolder input).
// The build FAILS on any page that is neither mapped, parsed, nor acknowledged,
// so a new page on docs.uaepass.ae surfaces as a decision, not silent drift.
//
// Everything docs.uaepass.ae-sourced is docs-tier provenance (STAGE1-HANDOFF.md
// §10.3/§10.6): provisional, carries sourceUrl + retrievedOn + contentHash,
// needs revalidation. UAE Pass is high-stakes: revalidate especially carefully.
//
//   node scripts/build-uaepass.mjs
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const inv = JSON.parse(readFileSync(join(repoRoot, "inventory", "uaepass.json"), "utf8"));

const P = "/guidelines/design-guidelines";
const F = "/feature-guides/authentication/web-application";

// --- reviewed mapping: guideline page -> rule kind --------------------------------
// Statement = the page's full extracted text, verbatim.
const RULE_PAGES = {
  [`${P}/button-guidelines`]: "usage",
  [`${P}/uaepass-button-guideline`]: "usage",
  [`${P}/button-guidelines/button-guidelines-english`]: "usage",
  [`${P}/button-guidelines/button-titles-arabic`]: "bilingual",
  [`${P}/button-guidelines/button-options`]: "usage",
  [`${P}/button-guidelines/button-radius`]: "usage",
  [`${P}/button-guidelines/button-size-and-margin`]: "usage",
  [`${P}/button-guidelines/button-states-and-feedback`]: "usage",
  [`${P}/button-guidelines/logo-only-buttons`]: "usage",
  [`${P}/button-guidelines/powered-by-uae-pass`]: "usage",
  [`${P}/button-guidelines/login-option`]: "usage",
  [`${P}/button-guidelines/tooltip-info`]: "usage",
  [`${P}/button-guidelines/sign-in-and-sign-up`]: "usage",
  [`${P}/button-guidelines/sign-in-and-sign-up/mobile-view`]: "usage",
  [`${P}/button-guidelines/sign-in-and-sign-up/mobile-view/portal-horizontal-and-vertical-view`]: "usage",
  [`${P}/button-guidelines/sign-in-and-sign-up/mobile-view/portal-horizontal-and-vertical-view/portal-vertical-sign-up-bottom`]: "usage",
  [`${P}/button-guidelines/sign-in-and-sign-up/mobile-view/portal-horizontal-and-vertical-view/portal-vertical-sign-up-top`]: "usage",
  [`${P}/button-guidelines/sign-with-uae-pass`]: "usage",
  [`${P}/button-guidelines/continue-with-uae-pass`]: "usage",
  [`${P}/button-guidelines/continue-with-uae-pass/user-journey-1`]: "usage",
  [`${P}/button-guidelines/continue-with-uae-pass/user-journey-2`]: "usage",
  [`${P}/button-guidelines/dos-and-donts`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/white-button`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/black-button`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/outline-button`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/logo-and-title-colors`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/sign-in-and-sign-up`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/using-logo-and-text`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/text-format`]: "usage",
  [`${P}/button-guidelines/dos-and-donts/text-visibility-and-spacing`]: "accessibility",
  [`${P}/button-guidelines/dos-and-donts/system-error`]: "usage",
};

// Image-only pages: guidance is entirely in the figures (no extractable text).
// Emitted as visual references (topic + image URLs + provenance), not rules.
const VISUAL_PAGES = new Set([
  `${P}/button-guidelines/sign-with-uae-pass/mobile-view-option-a-and-b`,
]);

// Pages consumed structurally (tables/attachments), not as verbatim rules.
const STRUCTURED_PAGES = new Set([
  `${F}/endpoints`,
  `${F}/1.-obtaining-the-oauth2-access-code`,
  `${F}/add-login-button`,
  `${P}/button-guidelines/button-assets`,
]);

// Acknowledged, deliberately unconsumed in v1 (scaffolder = login button + auth
// entry URL; these document later flow steps or separate design programmes).
const OUT_OF_SCOPE = new Set([
  P, // design-guidelines index (nav only)
  `${P}/account-linking-guidelines`,
  `${P}/account-linking-guidelines/automatic-linking`,
  `${P}/account-linking-guidelines/manual-linking`,
  `${P}/account-linking-guidelines/manual-linking/case-a`,
  `${P}/account-linking-guidelines/manual-linking/case-b`,
  `${P}/account-linking-guidelines/manual-linking/case-c`,
  `${P}/account-linking-guidelines/manual-linking/case-d`,
  `${P}/error-messages`,
  `${P}/text-message-guidelines`,
  F, // web-application index (nav only)
  `${F}/introduction`,
  `${F}/pre-requisites`,
  `${F}/2.-obtaining-the-access-token`,
  `${F}/3.-obtaining-authenticated-user-information-from-the-access-token`,
  `${F}/4.-web-single-sign-on-sso-and-logout-user-session-from-uae-pass`,
  `${F}/authentication-postman-walkthrough`,
]);

// --- coverage check: every snapshot page must be accounted for --------------------

const byPath = new Map(inv.pages.map((p) => [p.path, p]));
const unaccounted = inv.pages
  .map((p) => p.path)
  .filter(
    (p) =>
      !(p in RULE_PAGES) && !VISUAL_PAGES.has(p) && !STRUCTURED_PAGES.has(p) && !OUT_OF_SCOPE.has(p),
  );
const missing = [
  ...Object.keys(RULE_PAGES),
  ...VISUAL_PAGES,
  ...STRUCTURED_PAGES,
  ...OUT_OF_SCOPE,
].filter((p) => !byPath.has(p));
if (unaccounted.length || missing.length) {
  if (unaccounted.length)
    console.error(`UNACCOUNTED pages (map them or mark out-of-scope):\n  ${unaccounted.join("\n  ")}`);
  if (missing.length)
    console.error(`MAPPED pages missing from snapshot:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

const provenanceOf = (page) => ({
  tier: "docs",
  sourceUrl: page.url,
  retrievedOn: page.retrievedOn,
  contentHash: page.contentHash,
  docsVersion: null,
});

const fail = (msg) => {
  console.error(`BUILD FAILED: ${msg}`);
  process.exit(1);
};

// --- rules (verbatim page text) ----------------------------------------------------

const rules = Object.entries(RULE_PAGES).map(([path, kind]) => {
  const page = byPath.get(path);
  const captions = page.images
    .filter((i) => i.caption)
    .map((i) => `(figure) ${i.caption}`);
  const statement = [
    ...page.sections
      .map((s) => (s.heading === "intro" ? s.text : `${s.heading}\n${s.text}`))
      .filter(Boolean),
    ...captions,
  ].join("\n\n");
  if (!statement) fail(`rule page ${path} extracted no text — move it to VISUAL_PAGES?`);
  return { kind, topic: page.name, statement, provenance: provenanceOf(page) };
});

const visualGuidance = [...VISUAL_PAGES].map((path) => {
  const page = byPath.get(path);
  return { topic: page.name, images: page.images, provenance: provenanceOf(page) };
});

// --- endpoints (parsed from the two tables; asserted shape) ------------------------

function parseEndpoints(page) {
  const tables = page.sections.flatMap((s) => s.tables);
  if (tables.length !== 2) fail(`endpoints page: expected 2 tables, got ${tables.length}`);
  const [staging, production] = tables.map((t) => {
    const rows = Object.fromEntries(t.slice(1).map(([k, v]) => [k, v]));
    const out = {
      authorization: rows["Authorization"],
      token: rows["Token"],
      userInfo: rows["User Info"],
      logout: rows["Logout"],
    };
    for (const [k, v] of Object.entries(out))
      if (!/^https:\/\/[a-z0-9.-]+\.uaepass\.ae\//.test(v ?? ""))
        fail(`endpoints table: bad ${k} URL ${v}`);
    return out;
  });
  if (!staging.authorization.includes("stg-id.")) fail("first endpoints table is not staging");
  if (production.authorization.includes("stg-id.")) fail("second endpoints table is not production");
  return { staging, production, provenance: provenanceOf(page) };
}
const endpoints = parseEndpoints(byPath.get(`${F}/endpoints`));

// --- authorize query parameters (parsed from the OAuth step-1 table) ----------------

function parseAuthorizeParams(page) {
  const table = page.sections.flatMap((s) => s.tables).find((t) => t[0]?.[0] === "Name");
  if (!table) fail("oauth step-1 page: query-parameter table not found");
  const params = table.slice(1).map(([name, type, description]) => ({
    name: name.replace(/\\_/g, "_").replace(/\s/g, ""),
    type,
    description,
  }));
  const names = params.map((p) => p.name);
  for (const required of ["response_type", "redirect_uri", "client_id", "state", "scope", "acr_values", "ui_locales"])
    if (!names.includes(required)) fail(`authorize params: expected '${required}', got [${names}]`);
  return { params, provenance: provenanceOf(page) };
}
const authorize = parseAuthorizeParams(byPath.get(`${F}/1.-obtaining-the-oauth2-access-code`));

// --- minimum button size (asserted against the spec table) --------------------------

function parseMinSize(page) {
  const table = page.sections.flatMap((s) => s.tables)[0];
  const [w, h, m] = table?.[1] ?? [];
  if (!w?.startsWith("140pt") || !h?.startsWith("30pt") || !m?.includes("1/10"))
    fail(`button-size table drifted: ${JSON.stringify(table)}`);
  return {
    minWidth: w,
    minHeight: h,
    minMargin: m,
    preserveAspectRatio: true,
    provenance: provenanceOf(page),
  };
}
const minSize = parseMinSize(byPath.get(`${P}/button-guidelines/button-size-and-margin`));

// --- official button asset downloads ------------------------------------------------

const assets = [
  byPath.get(`${F}/add-login-button`),
  byPath.get(`${P}/button-guidelines/button-assets`),
].flatMap((page) =>
  page.files.map((f) => ({ label: f.label, url: f.url, provenance: provenanceOf(page) })),
);
if (!assets.length) fail("no button asset attachments found");

// --- curated variant/appearance/radius vocabulary -----------------------------------
// Ids are ours; every label/option is documented on the referenced page.

const ref = (path) => byPath.get(path).url;

const buttonVariants = [
  { id: "sign-in", label: "Sign in with UAE PASS", sourceUrl: ref(`${P}/button-guidelines/sign-in-and-sign-up`) },
  { id: "sign-up", label: "Sign up with UAE PASS", sourceUrl: ref(`${P}/button-guidelines/sign-in-and-sign-up`) },
  { id: "login", label: "Login with UAE PASS", sourceUrl: ref(`${P}/button-guidelines/login-option`) },
  { id: "continue", label: "Continue with UAE PASS", sourceUrl: ref(`${P}/button-guidelines/continue-with-uae-pass`) },
  { id: "sign", label: "Sign with UAE PASS", sourceUrl: ref(`${P}/button-guidelines/sign-with-uae-pass`) },
  { id: "logo-only", label: null, sourceUrl: ref(`${P}/button-guidelines/logo-only-buttons`) },
];

const appearances = [
  { id: "white", sourceUrl: ref(`${P}/button-guidelines/dos-and-donts/white-button`) },
  { id: "outline", sourceUrl: ref(`${P}/button-guidelines/dos-and-donts/outline-button`) },
  { id: "black", sourceUrl: ref(`${P}/button-guidelines/dos-and-donts/black-button`) },
];

const radiusOptions = [
  { id: "rectangle", note: "minimum radius", sourceUrl: ref(`${P}/button-guidelines/button-radius`) },
  { id: "default", note: "standard radius, 12 pixels", sourceUrl: ref(`${P}/button-guidelines/button-radius`) },
  { id: "pill", note: "maximum radius, 999", sourceUrl: ref(`${P}/button-guidelines/button-radius`) },
];

// --- write ---------------------------------------------------------------------------

const out = {
  meta: {
    schemaVersion: 1,
    origin: inv.origin,
    retrievedOn: inv.retrievedOn,
    note:
      "UAE Pass developer-docs guidance for the scaffolder. Docs-tier: provisional, high-stakes, needs revalidation against docs.uaepass.ae.",
  },
  buttonVariants,
  appearances,
  radiusOptions,
  minSize,
  endpoints,
  authorize,
  assets,
  rules,
  visualGuidance,
};

writeFileSync(join(repoRoot, "catalog", "uaepass.json"), JSON.stringify(out, null, 2) + "\n");
console.log(
  `uaepass.json: ${rules.length} rules, ${assets.length} assets, ${authorize.params.length} authorize params, ${buttonVariants.length} variants`,
);
console.log(`Written : catalog/uaepass.json`);
