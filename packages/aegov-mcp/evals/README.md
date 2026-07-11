# Eval suite — 10 government screens (build step 6)

The Stage-1 exit test (CLAUDE.md): across these 10 screens, a **connected AI
assistant** reliably emits valid, on-standard AEGOV DLS markup — correct
classes, correct structure, RTL-aware, bilingual-ready — **without
hand-correction**.

## Layout

- `screens/<id>.json` — one spec per screen: the natural-language prompt an
  assistant receives, and the machine checks its output must pass. Structure
  requirements are grounded in the official TDRA page templates
  (`design-refs/AEGOV-Templates/`, distributed by TDRA — kept outside this
  repo; `reference` names the template file(s) each spec was derived from).
- `outputs/<id>.html` — the assistant-generated screens under test.
- `scripts/run-evals.mjs` (repo root) — the judge. Boots the real MCP server
  over stdio, runs every output through `validate_snippet`, then applies the
  spec's structural checks. `npm run evals`.

## The rules (do not soften them)

1. **Never hand-edit an output to make it pass.** Outputs are produced by an
   AI assistant connected to the MCP server, from the spec's `prompt` alone.
   When a screen fails, the fix is upstream: improve the catalogue, the tool
   descriptions, or the scaffolders — then have an assistant regenerate.
2. **Generators don't see the checks.** The assistant gets `prompt`; the
   `checks` block belongs to the judge. An assistant that needs the checklist
   to produce a standard page is evidence the tools aren't carrying the
   standard yet.
3. **Specs require the invariants, allow the variation.** Derived from the
   TDRA templates: e.g. every page carries header, footer and the page-rating
   ("Did you find this content useful?") block; a service-details page keeps
   the v1–v3 invariant skeleton while CTA placement may vary.

## Screen list

| id | screen | key standards exercised |
|----|--------|------------------------|
| 01-homepage-ministry | Ministry homepage | hero, tabbed service cards, newsletter, blocks composition |
| 02-service-details | Service details page | accordion FAQ, service specs, UAE Pass access control |
| 03-services-list | Our-services list + filters | filter block, checkboxes, pagination, search |
| 04-services-cards | Services (cards layout) | tabs, card grid, pagination |
| 05-search-results | Search results | search form, result list, pagination |
| 06-contact-us | Contact us | form controls (input/select/textarea), labels |
| 07-news-article | News article (inner) | breadcrumb, article structure, related cards |
| 08-faqs | FAQs | accordion |
| 09-uaepass-login | Sign-in with UAE Pass | scaffoldUaePass, bilingual, official button rules |
| 10-emirates-id-form-rtl | Arabic RTL application form | scaffoldEmiratesId, dir="rtl", Emirates ID pattern |
