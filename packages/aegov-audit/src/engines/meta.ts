/**
 * Document-level HTML checks (STAGE2-HANDOFF §6 step 5 groundwork) — these
 * answer TDRA checklist items directly: 3.26 doctype, 3.27 charset,
 * 3.28 viewport, 3.32 canonical, 3.33 dir, 3.34 lang, 3.35 alternate
 * language tags. Cheap, unambiguous, rendered-DOM facts.
 */
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

type MetaScan = {
  doctypeHtml5: boolean;
  charset: string;
  viewport: string | null;
  canonical: string | null;
  lang: string;
  dir: string;
  alternates: string[];
  hasArabicText: boolean;
};

export async function runMetaChecks(page: Page): Promise<AuditFinding[]> {
  const scan = (await page.evaluate(() => ({
    doctypeHtml5:
      !!document.doctype &&
      document.doctype.name.toLowerCase() === "html" &&
      !document.doctype.publicId,
    charset: document.characterSet,
    viewport:
      document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null,
    canonical:
      (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? null,
    lang: document.documentElement.lang || "",
    dir: document.documentElement.dir || "",
    alternates: Array.from(
      document.querySelectorAll('link[rel="alternate"][hreflang]'),
    ).map((l) => l.getAttribute("hreflang") ?? ""),
    hasArabicText: /[؀-ۿ]/.test(document.body?.textContent ?? ""),
  }))) as MetaScan;

  const findings: AuditFinding[] = [];
  const add = (
    ruleId: string,
    severity: AuditSeverity,
    message: string,
    fix: string | null = null,
  ) =>
    findings.push({
      engine: "dls",
      ruleId,
      severity,
      confidence: "heuristic",
      message,
      fix,
      helpUrl: null,
      tags: ["aegov-dls", "html-meta"],
      targets: ["html"],
      nodeCount: 1,
    });

  if (!scan.doctypeHtml5)
    add("meta-doctype", "moderate", "The document does not use the HTML5 doctype (<!DOCTYPE html>).", "Put <!DOCTYPE html> as the first line of every page.");
  if (scan.charset.toUpperCase() !== "UTF-8")
    add("meta-charset", "moderate", `Character set is ${scan.charset}, not UTF-8.`, 'Declare <meta charset="utf-8"> before any content.');
  if (!scan.viewport)
    add("meta-viewport", "moderate", "No viewport meta tag — mobile rendering is not controlled.", 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
  if (!scan.canonical)
    add("meta-canonical", "minor", "No rel=canonical link — review whether duplicate-content indexing is possible on this page.", 'Add <link rel="canonical" href="…"> when the same content is reachable under several URLs.');
  if (!scan.lang)
    add("meta-lang", "serious", "The <html> element has no lang attribute — required for bilingual structure and assistive technology.", 'Set <html lang="en"> / <html lang="ar"> per language version.');
  if (!scan.dir) {
    add(
      "meta-dir",
      scan.hasArabicText || scan.lang.toLowerCase().startsWith("ar") ? "serious" : "minor",
      scan.hasArabicText || scan.lang.toLowerCase().startsWith("ar")
        ? "No direction attribute on the document although Arabic content/language is present — RTL is first-class in the standard."
        : "No direction attribute on the document — set it explicitly per language version.",
      'Set dir="rtl" on the Arabic version and dir="ltr" on the English version.',
    );
  }
  if (scan.alternates.length === 0)
    add("meta-alternate", "minor", "No alternate-language link tags (<link rel=\"alternate\" hreflang=…>) — pages should list their other-language version.", "Add hreflang alternate links on every page of both language versions.");

  return findings;
}
