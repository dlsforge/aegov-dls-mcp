/**
 * Stage 2C — technology-fingerprint checks. Both rules fire ONLY on hard,
 * self-declared evidence and report detected facts, never guesses (the
 * zero-false-positive bar this slice was built to):
 *
 *  - 3.60/3.61: a monolithic CMS rendering the page (meta generator tag —
 *    the CMS declaring itself — or unmistakable core asset paths). The
 *    checklist asks for a headless CMS with a JS-framework frontend; a
 *    monolith serving the HTML is direct evidence of the opposite. Absence
 *    of a signal proves nothing, so no signal → no finding.
 *  - 2.21: an icon library other than the approved one in active use.
 *    Approved library per the iconography guideline: Phosphor
 *    (designsystem.gov.ae/guidelines/iconography, retrieved 2026-07-22) —
 *    docs-sourced, so the finding carries docs-tier confidence and tells the
 *    reviewer to confirm against the current guideline.
 */
import type { Page } from "playwright";
import type { AuditFinding } from "../report/types.js";

const ICON_GUIDELINE = "https://designsystem.gov.ae/guidelines/iconography";
const ICON_GUIDELINE_RETRIEVED = "2026-07-22";

type StackScan = {
  cms: { name: string; signal: string } | null;
  iconLibrary: { name: string; signal: string; count: number } | null;
};

export async function runStackChecks(page: Page): Promise<AuditFinding[]> {
  const scan = (await page.evaluate(() => {
    /* ---- monolithic CMS: only self-declared or core-asset evidence */
    let cms: { name: string; signal: string } | null = null;
    const generator =
      document.querySelector('meta[name="generator" i]')?.getAttribute("content") ?? "";
    const genMatch = generator.match(
      /wordpress|joomla|drupal|typo3|sitefinity|umbraco|kentico|sitecore|sharepoint|dotnetnuke|dnn/i,
    );
    if (genMatch) {
      cms = { name: genMatch[0], signal: `meta generator "${generator.slice(0, 80)}"` };
    } else {
      const assetUrls = Array.from(document.querySelectorAll("script[src], link[href]")).map(
        (el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "",
      );
      // Core paths only — /wp-content/uploads is excluded on purpose: media
      // can be proxied by headless frontends, core script paths cannot.
      const wp = assetUrls.find((u) => u.includes("/wp-includes/"));
      const sp = assetUrls.find((u) => /\/_layouts\/\d+\//.test(u));
      if (wp) cms = { name: "WordPress", signal: `core asset ${wp.slice(0, 100)}` };
      else if (sp) cms = { name: "SharePoint", signal: `layouts asset ${sp.slice(0, 100)}` };
      else if ((window as unknown as Record<string, unknown>).Drupal !== undefined)
        cms = { name: "Drupal", signal: "window.Drupal global" };
    }

    /* ---- icon library other than the approved one, in active use */
    let iconLibrary: StackScanIcon = null;
    type StackScanIcon = { name: string; signal: string; count: number } | null;
    const links = Array.from(document.querySelectorAll("link[href]")).map(
      (l) => l.getAttribute("href") ?? "",
    );
    const faLink = links.find((h) => /font-?awesome/i.test(h));
    const faEls = document.querySelectorAll('[class^="fa-"], [class*=" fa-"], i[class^="fa "], i[class*=" fa "]').length;
    const materialEls = document.querySelectorAll(".material-icons, .material-symbols-outlined").length;
    const materialLink = links.find((h) => /family=Material\+(Icons|Symbols)/i.test(h));
    const biEls = document.querySelectorAll('[class^="bi-"], [class*=" bi-"]').length;
    const biLink = links.find((h) => /bootstrap-icons/i.test(h));
    if (faLink || faEls >= 3)
      iconLibrary = {
        name: "Font Awesome",
        signal: faLink ? `stylesheet ${faLink.slice(0, 100)}` : `${faEls} fa-* classed elements`,
        count: faEls,
      };
    else if (materialLink || materialEls >= 3)
      iconLibrary = {
        name: "Material Icons",
        signal: materialLink ? `stylesheet ${materialLink.slice(0, 100)}` : `${materialEls} material-icons elements`,
        count: materialEls,
      };
    else if (biLink || biEls >= 3)
      iconLibrary = {
        name: "Bootstrap Icons",
        signal: biLink ? `stylesheet ${biLink.slice(0, 100)}` : `${biEls} bi-* classed elements`,
        count: biEls,
      };

    return { cms, iconLibrary };
  })) as StackScan;

  const findings: AuditFinding[] = [];
  if (scan.cms)
    findings.push({
      engine: "dls",
      ruleId: "stack-monolithic-cms",
      severity: "minor",
      confidence: "heuristic",
      message:
        `${scan.cms.name} is rendering this page (detected via ${scan.cms.signal}) — a monolithic ` +
        `CMS serving the HTML directly. The checklist asks for a headless CMS (3.60) with a ` +
        `JavaScript-framework frontend such as Next.js (3.61). This is a detected fact about the ` +
        `served page; confirm the architecture with the team before answering.`,
      fix: "If a re-platform is planned, the checklist's target architecture is headless CMS + JS-framework frontend.",
      helpUrl: null,
      tags: ["aegov-dls", "stack", "tier-2c"],
      targets: [scan.cms.signal.slice(0, 100)],
      nodeCount: 1,
    });
  if (scan.iconLibrary)
    findings.push({
      engine: "dls",
      ruleId: "stack-icon-library",
      severity: "minor",
      confidence: "docs",
      message:
        `${scan.iconLibrary.name} is in use on this page (${scan.iconLibrary.signal}) — the ` +
        `iconography guideline names Phosphor as the design system's approved icon library ` +
        `(docs-sourced, retrieved ${ICON_GUIDELINE_RETRIEVED}; confirm against the current guideline).`,
      fix: "Migrate icons to the approved Phosphor library, or record the exception for the reviewer.",
      helpUrl: ICON_GUIDELINE,
      tags: ["aegov-dls", "stack", "tier-2c"],
      targets: [scan.iconLibrary.signal.slice(0, 100)],
      nodeCount: Math.max(1, scan.iconLibrary.count),
    });
  return findings;
}
