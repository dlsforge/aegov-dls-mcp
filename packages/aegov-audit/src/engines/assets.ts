/**
 * Stage 2B Tier B — document/asset checks answering TDRA checklist items with
 * rendered-DOM facts: 2.35 skip link, 3.8 icon aria-hidden, 3.9 icon text,
 * 3.30 favicon, 3.31 theme-colour meta, 3.36 Open Graph tags, 3.37 semantic
 * HTML5, 3.39 rel=noopener, 3.41 fonts source, 3.57 script placement,
 * 3.59 cookie banner.
 *
 * Conservative (STAGE2B-HANDOFF §9): where a check is a heuristic (skip link,
 * cookie banner) the message says so; where browsers mitigate by default
 * (implicit noopener on target=_blank) the message says that too. A finding
 * here answers the checklist's own written question — it never editorializes.
 */
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

type AssetScan = {
  iconLinks: number;
  appleTouchIcon: boolean;
  themeColorMeta: boolean;
  ogTags: number;
  semanticCounts: Record<string, number>;
  blankNoOpener: { count: number; samples: string[] };
  headBlockingScripts: { count: number; samples: string[] };
  cookieBannerSignal: boolean;
  skipLink: boolean;
  iconsUnmarked: { count: number; samples: string[] };
  iconOnlyNoName: { count: number; samples: string[] };
  selfHostedFontFaces: string[];
  googleFontsLink: boolean;
};

export async function runAssetChecks(page: Page): Promise<AuditFinding[]> {
  const scan = (await page.evaluate(() => {
    const sel = (q: string) => Array.from(document.querySelectorAll(q));
    const cssPath = (el: Element) => {
      const id = el.getAttribute("id");
      const cls = (el.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      return el.tagName.toLowerCase() + (id ? `#${id}` : "") + (cls.length ? `.${cls.join(".")}` : "");
    };

    const anchors = sel('a[target="_blank"]').filter((a) => {
      const rel = (a.getAttribute("rel") ?? "").toLowerCase();
      return !rel.includes("noopener") && !rel.includes("noreferrer");
    });

    const headScripts = Array.from(document.head?.querySelectorAll("script[src]") ?? []).filter(
      (s) =>
        !s.hasAttribute("defer") &&
        !s.hasAttribute("async") &&
        (s.getAttribute("type") ?? "").toLowerCase() !== "module",
    );

    // Cookie banner: id/class naming OR a dialog/fixed-ish element mentioning cookies.
    const cookieByName = sel('[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i]').length > 0;
    const cookieByText = /cookies?|ملفات تعريف الارتباط/i.test(
      Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog'))
        .map((e) => e.textContent ?? "")
        .join(" "),
    );

    // Skip link: an in-page anchor early in the DOM (or sr-only/skip-classed)
    // whose text or target says "skip"/"content" (en/ar).
    const skipLink = sel('a[href^="#"]').some((a) => {
      const text = (a.textContent ?? "").trim();
      const href = a.getAttribute("href") ?? "";
      const cls = a.getAttribute("class") ?? "";
      return (
        /skip|تخط/i.test(text + " " + cls) ||
        /^#(main|content|main-content|maincontent)$/i.test(href)
      );
    });

    // Icons: svg or <i>/<span> with icon-ish classes.
    const iconEls = [
      ...sel("svg"),
      ...sel('i[class*="icon" i], span[class*="icon" i], i[class^="fa-"], i[class*=" fa-"]'),
    ];
    const hasName = (el: Element) =>
      el.hasAttribute("aria-label") ||
      el.hasAttribute("aria-labelledby") ||
      (el.tagName.toLowerCase() === "svg" && el.querySelector("title") !== null);
    const unmarked = iconEls.filter(
      (el) =>
        el.getAttribute("aria-hidden") !== "true" &&
        !hasName(el) &&
        (el.textContent ?? "").trim() === "",
    );

    // Interactive elements whose only content is an icon and that carry no
    // accessible name and no visible/sr-only text (checklist 3.9).
    const iconOnly = sel("a, button").filter((el) => {
      if ((el.textContent ?? "").trim() !== "") return false;
      if (!el.querySelector("svg, i, span, img")) return false;
      if (el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) return false;
      if (el.getAttribute("title")) return false;
      const img = el.querySelector("img");
      if (img && (img.getAttribute("alt") ?? "").trim() !== "") return false;
      return true;
    });

    // @font-face sources readable from same-origin stylesheets.
    const selfHostedFonts: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules; // cross-origin sheets throw — skip them
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule.constructor.name !== "CSSFontFaceRule") continue;
        const src = (rule as CSSFontFaceRule).style.getPropertyValue("src");
        for (const m of src.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
          try {
            // protocol+host comparison instead of origin: file:// origins are
            // opaque ("null") per spec, which would break same-origin checks
            // on local fixtures.
            const u = new URL(m[2], sheet.href ?? location.href);
            if (u.protocol === location.protocol && u.host === location.host)
              selfHostedFonts.push(u.pathname);
          } catch {
            /* unparseable url — ignore */
          }
        }
      }
    }

    return {
      iconLinks: sel('link[rel~="icon" i], link[rel="shortcut icon" i]').length,
      appleTouchIcon: sel('link[rel="apple-touch-icon" i]').length > 0,
      themeColorMeta:
        sel('meta[name="theme-color" i], meta[name="apple-mobile-web-app-status-bar-style" i]')
          .length > 0,
      ogTags: sel('meta[property^="og:" i]').length,
      semanticCounts: Object.fromEntries(
        ["main", "header", "footer", "nav", "section", "article"].map((t) => [
          t,
          document.getElementsByTagName(t).length,
        ]),
      ),
      blankNoOpener: { count: anchors.length, samples: anchors.slice(0, 10).map(cssPath) },
      headBlockingScripts: {
        count: headScripts.length,
        samples: headScripts.slice(0, 10).map((s) => s.getAttribute("src") ?? ""),
      },
      cookieBannerSignal: cookieByName || cookieByText,
      skipLink,
      iconsUnmarked: { count: unmarked.length, samples: unmarked.slice(0, 10).map(cssPath) },
      iconOnlyNoName: { count: iconOnly.length, samples: iconOnly.slice(0, 10).map(cssPath) },
      selfHostedFontFaces: [...new Set(selfHostedFonts)].slice(0, 10),
      googleFontsLink:
        sel('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').length > 0,
    };
  })) as AssetScan;

  const findings: AuditFinding[] = [];
  const add = (
    ruleId: string,
    severity: AuditSeverity,
    message: string,
    fix: string | null = null,
    targets: string[] = ["html"],
    nodeCount = 1,
  ) =>
    findings.push({
      engine: "dls",
      ruleId,
      severity,
      confidence: "heuristic",
      message,
      fix,
      helpUrl: null,
      tags: ["aegov-dls", "assets"],
      targets: targets.slice(0, 10),
      nodeCount,
    });

  if (scan.iconLinks === 0)
    add(
      "dom-favicon",
      "minor",
      "No favicon <link> declared" +
        (scan.appleTouchIcon ? "" : " and no apple-touch-icon") +
        " — browsers may fall back to /favicon.ico, but the checklist asks for declared variants for bookmarking sizes.",
      'Declare <link rel="icon" …> (with sizes) plus <link rel="apple-touch-icon" …>.',
    );
  if (!scan.themeColorMeta)
    add(
      "dom-theme-color",
      "minor",
      "No theme-color / Apple status-bar meta tag — the browser pre-header colour is not controlled.",
      'Add <meta name="theme-color" content="…"> (and the Apple status-bar variant).',
    );
  if (scan.ogTags === 0)
    add(
      "dom-og-tags",
      "moderate",
      "No Open Graph meta tags (og:*) on the page — social-media shares will not carry controlled title/image.",
      "Emit og:title, og:description and og:image per page (the CMS should generate them).",
    );
  if (Object.values(scan.semanticCounts).every((n) => n === 0))
    add(
      "dom-semantic-tags",
      "moderate",
      "No HTML5 semantic elements found (main/header/footer/nav/section/article) — the document is not structured semantically.",
      "Structure the page with semantic HTML5 landmarks instead of generic <div>s.",
    );
  if (scan.blankNoOpener.count > 0)
    add(
      "dom-noopener",
      "minor",
      `${scan.blankNoOpener.count} link(s) with target="_blank" lack rel="noopener" — modern browsers imply it, but the design-system guideline asks for it explicitly.`,
      'Add rel="noopener" (or "noopener noreferrer") to links opening new tabs.',
      scan.blankNoOpener.samples,
      scan.blankNoOpener.count,
    );
  if (scan.headBlockingScripts.count > 0)
    add(
      "dom-blocking-script-head",
      "moderate",
      `${scan.headBlockingScripts.count} script(s) load synchronously in <head> (no defer/async/module): ` +
        scan.headBlockingScripts.samples.join(", ") +
        " — the checklist asks for JavaScript at the end of the page.",
      "Move scripts before </body> or mark them defer/async.",
      scan.headBlockingScripts.samples,
      scan.headBlockingScripts.count,
    );
  if (!scan.cookieBannerSignal)
    add(
      "dom-cookie-banner",
      "minor",
      "No cookie banner detected in the rendered DOM (heuristic — a banner may load conditionally or after consent-state checks). The checklist requires one.",
      "Add a cookie/consent banner if the site sets non-essential cookies; verify it renders on first visit.",
    );
  if (!scan.skipLink)
    add(
      "dom-skip-link",
      "moderate",
      'No "skip to content" link detected among in-page anchors (heuristic — checked link text/class/target in English and Arabic).',
      'Add a (visually hidden, focus-visible) <a href="#main">Skip to content</a> as the first focusable element.',
    );
  if (scan.iconsUnmarked.count > 0)
    add(
      "dom-icon-aria-hidden",
      "moderate",
      `${scan.iconsUnmarked.count} icon element(s) are neither aria-hidden="true" nor given an accessible name — screen readers may announce them meaninglessly.`,
      'Add aria-hidden="true" to decorative icons; give meaningful icons an accessible name.',
      scan.iconsUnmarked.samples,
      scan.iconsUnmarked.count,
    );
  if (scan.iconOnlyNoName.count > 0)
    add(
      "dom-icon-no-text",
      "moderate",
      `${scan.iconOnlyNoName.count} icon-only link(s)/button(s) carry no supporting text — neither visible, sr-only, nor aria-label.`,
      'Add visible text, a .sr-only span, or an aria-label to every icon-only control.',
      scan.iconOnlyNoName.samples,
      scan.iconOnlyNoName.count,
    );
  if (scan.selfHostedFontFaces.length > 0 && !scan.googleFontsLink)
    add(
      "dom-selfhosted-fonts",
      "minor",
      `@font-face sources load from this origin (${scan.selfHostedFontFaces.join(", ")}) and no Google Fonts link is present — the checklist's written rule asks for Google Fonts rather than server-hosted fonts.`,
      "This mirrors checklist item 3.41 as written; if self-hosting is a deliberate decision, note it for the human reviewer.",
      scan.selfHostedFontFaces,
      scan.selfHostedFontFaces.length,
    );

  return findings;
}
