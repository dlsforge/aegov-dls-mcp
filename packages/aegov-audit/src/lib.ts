/**
 * Library entry for @dlsforge/aegov-audit — the stable programmatic surface.
 *
 * The CLI lives in index.ts (the bin) and EXECUTES on import; this module has
 * no side effects, so downstream tools (the AEGOV AI Studio's parity reuse
 * was the first consumer) can import engines, report builders and types
 * without launching an audit. Promised as the "library exports surface" in
 * the Studio handoff's open-decision #4; deep dist/ imports keep working via
 * the package.json "./dist/*" passthrough for one release of migration room.
 *
 * Everything re-exported here is considered public API — additions are fine,
 * renames/removals are semver-major.
 */

// Normalized finding shape + severity helpers
export * from "./report/types.js";
// TDRA checklist model (criteria loader, item views, machine-checkable set)
export * from "./report/tdra.js";
// Report aggregation (buildReport/renderMarkdown) and the AuditReport shape
export * from "./report/report.js";
// TDRA workbook writer (fillWorkbook/resolveTemplate and the zip primitives)
export * from "./report/xlsx.js";
// Evidence-bundle writer (screenshots, extracted copy, image inventory)
export * from "./artifacts.js";

// Engines — each run* function takes a Playwright Page/Browser the caller owns.
export { runAxe, AXE_VERSION } from "./engines/axe.js";
export { runDlsRules, dlsPackageRef } from "./engines/dls.js";
export { runTokenFidelity } from "./engines/tokens.js";
export { runStructureChecks } from "./engines/structure.js";
export { runUaePassCheck } from "./engines/uaepass.js";
export { runMetaChecks } from "./engines/meta.js";
export { runAssetChecks } from "./engines/assets.js";
export { runMediaChecks } from "./engines/media.js";
export { runHttpChecks, NOT_FOUND_PROBE_PATH, UA } from "./engines/http.js";
export { runParityCheck, discoverAlternate } from "./engines/parity.js";
export { settleNavigation } from "./engines/settle.js";
export { runLighthouseBoth, type LighthouseScores } from "./engines/lighthouse.js";
export { deriveLighthouseFindings } from "./engines/lighthouse-findings.js";
export { runStyleChecks } from "./engines/styles.js";
export {
  runZoomCheck,
  runKeyboardChecks,
  runBreakpointCheck,
  DLS_BREAKPOINTS,
} from "./engines/interaction.js";
export { runCrawlChecks, CRAWL_CAP, parseRobots } from "./engines/crawl.js";
export { runStackChecks } from "./engines/stack.js";
export { runHtmlValidation } from "./engines/validate-html.js";
