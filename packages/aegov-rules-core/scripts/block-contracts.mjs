// Curated conformance contracts for the docs blocks that carry a normative one.
//
// WHY CURATED, NOT DERIVED: a docs markup example is a whole page of one entity's
// content (the header example is ~50 KB of menus), so "does the rendered page
// match the example" is not a question any real site passes. What IS checkable is
// the small set of invariants the docs actually mandate — the block root element,
// the mobile affordance the docs describe, the numeric limit written in prose.
// Each requirement below cites the sentence or the markup it comes from, and
// validate-catalog asserts that citation is verbatim-present on the source page.
//
// FALSE-POSITIVE POSTURE (Stage 2C rule: a wrong assertion against a government
// site is worse than a missing one). Every requirement is gated: when its anchor
// is absent the result is "not-applicable", which consumers surface as
// "not-checked" — never a silent pass and never a guess. Requirements considered
// and deliberately NOT written:
//   - logo must be SVG / ≤110px high: "the logo" cannot be pinned (skip links
//     routinely precede it) and the docs hedge the height for authorities.
//   - secondary-nav icon set (login / accessibility / language): entities
//     localize labels and ids, so absence is not distinguishable from renaming.
//   - "first nav element must link to the homepage": locale roots (/, /en, /ar,
//     /index.html, culture-cookie sites) make "is this the homepage" unreliable.
// Add them only if a zero-false-positive anchor is found.

// STALENESS: `authoredAgainstContentHash` is the docs page's extracted-content
// hash AT THE TIME A HUMAN REVIEWED THESE INVARIANTS. It is a literal on
// purpose — it must be able to disagree with the live page. build-catalog.mjs
// compares it to the freshly extracted page and FAILS when they differ, which
// forces a re-read of the changed page before the contract can ship again.
// (Copying the hash out of the extraction at build time would make the check a
// tautology: both sides would move together and never disagree.)
// To update: re-read the page, confirm each requirement still reflects it, then
// paste the new hash from `inventory/docs.json`.

/** @type {Array<{blockId: string, authoredAgainstContentHash: string, requirements: Array<object>}>} */
export const BLOCK_CONTRACTS = [
  {
    blockId: "header",
    // Reviewed 2026-07-26 against the 2026-07-25 snapshot (content unchanged
    // since the 2026-07-07 capture).
    authoredAgainstContentHash:
      "8dfcb9fb103e2a68a2fa584d836d010b2903edeeb4bc3035c38518eccf3fabda",
    requirements: [
      {
        id: "header.root",
        statement:
          "The page header must be the DLS header block — a <header> element carrying the aegov-header class.",
        severity: "error",
        check: { kind: "present", selector: "header.aegov-header" },
        gate: null,
        evidence: { kind: "markup", quote: '<header class="aegov-header">' },
        fix: 'Use the DLS header block: <header class="aegov-header"> … </header> (designsystem.gov.ae/docs/blocks/header).',
      },
      {
        id: "header.mobile-menu",
        statement:
          "The header must provide the documented mobile menu affordance — the docs ship a distinct mobile header opened from a control inside the header.",
        severity: "warning",
        check: {
          kind: "present",
          selector:
            "header.aegov-header [data-modal-toggle], header.aegov-header [data-collapse-toggle], header.aegov-header [aria-controls], header.aegov-header [aria-expanded]",
        },
        gate: "header.aegov-header",
        evidence: {
          kind: "guidance",
          quote: "we have crafted two distinct headers - one for mobile and one for desktop",
        },
        fix: "Add the documented mobile header: a toggle control inside the header wired to the mobile menu container (aria-controls / data-modal-toggle).",
      },
      {
        id: "header.nav-max-items",
        statement: "A primary navigation must not carry more than 7 top-level elements.",
        severity: "error",
        check: {
          kind: "count-max",
          groupSelector: "header.aegov-header ul.nav-menu",
          childSelector: ":scope > li",
          max: 7,
        },
        gate: "header.aegov-header ul.nav-menu",
        evidence: {
          kind: "guidance",
          quote: "There cannot be more than 7 elements added to a navigation.",
        },
        fix: "Reduce the primary navigation to at most 7 top-level items; move the rest under the optional 'More' dropdown.",
      },
    ],
  },
  {
    blockId: "footer",
    // Reviewed 2026-07-26 against the 2026-07-25 snapshot (content unchanged
    // since the 2026-07-07 capture).
    authoredAgainstContentHash:
      "66e57240c49b5e995f23517b0cb6923a321879d1c78930f154f18218bca9696d",
    requirements: [
      {
        id: "footer.root",
        statement:
          "The page footer must be the DLS footer block — a <footer> element carrying the aegov-footer class.",
        severity: "error",
        check: { kind: "present", selector: "footer.aegov-footer" },
        gate: null,
        evidence: { kind: "markup", quote: '<footer class="aegov-footer">' },
        fix: 'Use the DLS footer block: <footer class="aegov-footer"> … </footer> (designsystem.gov.ae/docs/blocks/footer).',
      },
      {
        id: "footer.mobile-accordion",
        statement:
          "The footer must collapse into the documented accordion on mobile (the aegov-mobile-accordion navigation).",
        severity: "warning",
        check: {
          kind: "present",
          selector: "footer.aegov-footer .aegov-mobile-accordion",
        },
        gate: "footer.aegov-footer",
        evidence: {
          kind: "guidance",
          quote: "adapting gracefully into an accordion layout on mobile devices",
        },
        fix: 'Wrap the footer link groups in the documented accordion navigation: <nav class="aegov-accordion aegov-mobile-accordion" data-accordion="collapse">.',
      },
      {
        id: "footer.copyright-year",
        statement:
          "The footer copyright year must be current — the docs require it to be a dynamic element that changes every year.",
        severity: "warning",
        check: { kind: "text-current-year", selector: "footer.aegov-footer" },
        gate: "footer.aegov-footer",
        evidence: {
          kind: "guidance",
          quote: "The year, which must be a dynamic element and auto change every year.",
        },
        fix: "Render the copyright year dynamically so it always shows the current year.",
      },
    ],
  },
];
