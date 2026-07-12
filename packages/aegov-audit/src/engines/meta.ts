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
  /** Arabic letters / (Arabic + Latin letters) over the visible body text. */
  arabicRatio: number;
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
    arabicRatio: (() => {
      const text = (document.body?.textContent ?? "").slice(0, 20000);
      const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
      const latin = (text.match(/[A-Za-z]/g) ?? []).length;
      return arabic + latin === 0 ? 0 : arabic / (arabic + latin);
    })(),
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
  // Declared language vs the script the content is actually written in —
  // found live on fnrc.gov.ae (step-7 recorded run): an Arabic page declaring
  // lang="en" misleads assistive technology and search engines alike.
  const declaresArabic = scan.lang.toLowerCase().startsWith("ar");
  if (scan.lang && !declaresArabic && scan.arabicRatio > 0.5)
    add(
      "meta-lang-mismatch",
      "serious",
      `The document declares lang="${scan.lang}" but the visible text is predominantly Arabic ` +
        `(${Math.round(scan.arabicRatio * 100)}% Arabic script) — the declared language must match the content.`,
      'Serve the Arabic variant with <html lang="ar" dir="rtl"> (and the English variant with lang="en").',
    );
  if (declaresArabic && scan.arabicRatio < 0.2 && scan.arabicRatio > 0)
    add(
      "meta-lang-mismatch",
      "serious",
      `The document declares lang="${scan.lang}" but the visible text is predominantly Latin script ` +
        `(only ${Math.round(scan.arabicRatio * 100)}% Arabic) — the declared language must match the content.`,
      'Serve the English variant with <html lang="en"> (and the Arabic variant with lang="ar" dir="rtl").',
    );
  if (scan.alternates.length === 0)
    add("meta-alternate", "minor", "No alternate-language link tags (<link rel=\"alternate\" hreflang=…>) — pages should list their other-language version.", "Add hreflang alternate links on every page of both language versions.");

  return findings;
}
