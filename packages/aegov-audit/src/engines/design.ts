/**
 * Design-conformance checks that the rendered page can answer on its own.
 *
 * Scope rule (Alam, 2026-08-13): a checklist item belongs here only when the
 * page itself settles it yes or no. Items asking whether a conversation, a
 * workshop or a design process happened stay with the human reviewer even
 * when some related outcome is observable — an observable outcome is not the
 * question that was asked.
 *
 * Items answered: 2.28 mobile-first CSS, 2.31 buttons distinguishable from hyperlinks, 2.33 form elements built
 * from DLS components, 3.5 not boxing the whole site, 3.44 graceful
 * degradation, 3.45 outdated-browser notice, 1.15 British-English copy.
 *
 * Every check fails soft: where the page carries no anchor for a rule (no
 * forms, no prose links, no readable stylesheets) it reports the rule as
 * not-applicable, so its item reads "not checked" rather than clean.
 */
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

/** Browser versions this old in a support notice mean the notice was never revisited. */
const STALE_BROWSER_YEAR_MARKERS =
  /\b(?:ie|internet explorer)\s*(?:[6-9]|1[01])\b|firefox\s*(?:[1-9]|1\d|2\d)\b|chrome\s*(?:[1-9]|1\d|2\d)\b|safari\s*[1-9]\b|opera\s*(?:[1-9]|1\d)\b/i;

/**
 * American spellings with unambiguous British counterparts. Deliberately
 * short: every entry must be wrong in British English in ALL contexts, so
 * "program" (correct for software) and "practice/practise" (noun vs verb)
 * are excluded on purpose.
 */
const AMERICANISMS: Array<[RegExp, string]> = [
  [/\bcolor(s|ed|ing)?\b/gi, "colour"],
  [/\bcenter(s|ed|ing)?\b/gi, "centre"],
  [/\borganiz(e|es|ed|ing|ation|ations)\b/gi, "organis-"],
  [/\bcatalog(s|ed)?\b/gi, "catalogue"],
  [/\bfavor(s|ed|ing|ite|ites)?\b/gi, "favour"],
  [/\bhonor(s|ed|ing|able)?\b/gi, "honour"],
  [/\blabor(s|ed|ing)?\b/gi, "labour"],
  [/\bneighbor(s|hood|ing)?\b/gi, "neighbour"],
  [/\bbehavior(s|al)?\b/gi, "behaviour"],
  [/\bfulfill(s|ed|ing|ment)?\b/gi, "fulfil"],
  // Double-l only: "enrolment" is the British form and must never match.
  [/\benrollment\b/gi, "enrolment"],
  [/\b(?:traveling|traveled)\b/gi, "travelling/travelled"],
  [/\blicense[ds]?\b(?=\s+(?:is|are|was|were|number|no\b))/gi, "licence (noun)"],
];

type DesignScan = {
  lang: string;
  latinShare: number;
  textSample: string;
  actions: {
    buttons: number;
    proseLinks: number;
    buttonSignature: string | null;
    linkSignature: string | null;
  };
  boxed: { boxed: boolean; selector: string | null; wrapperWidth: number; viewport: number };
  forms: { controls: number; dlsControls: number; example: string | null };
  degradation: { noscript: number; moduleScripts: number; noModuleFallback: number };
  browserNotice: { found: boolean; text: string | null };
  css: { readable: number; unreadable: number; minWidth: number; maxWidth: number };
};

async function scan(page: Page): Promise<DesignScan> {
  return (await page.evaluate(() => {
    const px = (v: string) => parseFloat(v) || 0;
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };


    /* ---- 2.31: is a button visually distinct from a hyperlink? */
    const sig = (el: Element) => {
      const cs = getComputedStyle(el);
      const border =
        px(cs.borderTopWidth) + px(cs.borderRightWidth) + px(cs.borderBottomWidth) + px(cs.borderLeftWidth);
      const pad = px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.paddingLeft) + px(cs.paddingRight);
      const bg = cs.backgroundColor;
      const opaque = !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/i.test(bg);
      return [
        opaque ? `bg:${bg}` : "bg:none",
        border > 0 ? "border:yes" : "border:no",
        pad >= 8 ? "pad:yes" : "pad:no",
        /underline/i.test(cs.textDecorationLine) ? "underline:yes" : "underline:no",
      ].join("|");
    };
    const buttonEls = Array.from(
      document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a.btn'),
    ).filter(vis);
    const proseLinkEls = Array.from(document.querySelectorAll("p a[href], li a[href]")).filter(vis);
    const mode = (els: Element[]) => {
      const counts = new Map<string, number>();
      for (const el of els) {
        const s = sig(el);
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
      let best: string | null = null;
      let n = 0;
      for (const [k, v] of counts) if (v > n) ((best = k), (n = v));
      return best;
    };

    /* ---- 3.5: is the WHOLE site inside one fixed-width box? */
    const header = document.querySelector("header") ?? document.querySelector('[role="banner"]');
    const footer = document.querySelector("footer") ?? document.querySelector('[role="contentinfo"]');
    let boxed = false;
    let boxedSel: string | null = null;
    let wrapperWidth = 0;
    const viewport = document.documentElement.clientWidth;
    if (header && footer) {
      // Nearest common ancestor of header and footer, excluding html/body.
      const chain = (el: Element | null) => {
        const out: Element[] = [];
        for (let n = el; n; n = n.parentElement) out.push(n);
        return out;
      };
      const hChain = new Set(chain(header));
      let common: Element | null = null;
      for (const n of chain(footer)) {
        if (hChain.has(n)) {
          common = n;
          break;
        }
      }
      if (common && common !== document.body && common !== document.documentElement) {
        const r = common.getBoundingClientRect();
        wrapperWidth = Math.round(r.width);
        // A wrapper meaningfully narrower than the viewport, holding both the
        // header and the footer, IS the whole site in a box.
        if (viewport > 0 && r.width > 0 && r.width < viewport - 24) {
          boxed = true;
          boxedSel =
            common.tagName.toLowerCase() +
            (common.id ? `#${common.id}` : "") +
            (common.className && typeof common.className === "string"
              ? "." + common.className.trim().split(/\s+/).slice(0, 2).join(".")
              : "");
        }
      }
    }

    /* ---- 2.33: form controls built from DLS components */
    const controls = Array.from(document.querySelectorAll("input, select, textarea")).filter(
      (el) => vis(el) && (el as HTMLInputElement).type !== "hidden",
    );
    const dlsControls = controls.filter((el) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = typeof n.className === "string" ? n.className : "";
        if (/\baegov-/.test(c)) return true;
      }
      return false;
    });

    /* ---- 3.44: graceful degradation signals */
    const scripts = Array.from(document.querySelectorAll("script"));
    const moduleScripts = scripts.filter((s) => s.getAttribute("type") === "module").length;
    const noModuleFallback = scripts.filter((s) => s.hasAttribute("nomodule")).length;

    /* ---- 3.45: an outdated-browser notice anywhere in the document */
    const bodyText = (document.body?.textContent ?? "").slice(0, 200_000);
    const html = document.documentElement.outerHTML.slice(0, 400_000);
    // "Best viewed in ..." is the legacy phrasing of the same notice and is
    // still what most UAE government portals ship — miss it and the rule
    // reports "no notice" on a page that plainly has one.
    const noticeRe =
      /outdated browser|update your browser|upgrade your browser|unsupported browser|browser is not supported|best viewed|recommended browsers?|supported browsers?|browser-update|browserupdate|يفضل تصفح|متصفح.{0,30}(قديم|حديث|مدعوم)|الأفضل تصفح/i;
    const m = bodyText.match(noticeRe) ?? html.match(noticeRe);
    let noticeText: string | null = null;
    if (m) {
      const src = bodyText.includes(m[0]) ? bodyText : html;
      const i = src.indexOf(m[0]);
      noticeText = src.slice(Math.max(0, i - 40), i + 200).replace(/\s+/g, " ").trim();
    }

    /* ---- 2.28: mobile-first = min-width media queries dominate */
    let readable = 0;
    let unreadable = 0;
    let minWidth = 0;
    let maxWidth = 0;
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        const anyRule = rule as CSSRule & { media?: MediaList; cssRules?: CSSRuleList };
        if (anyRule.media?.mediaText) {
          const t = anyRule.media.mediaText;
          for (const _ of t.matchAll(/min-width/gi)) minWidth++;
          for (const _ of t.matchAll(/max-width/gi)) maxWidth++;
        }
        if (anyRule.cssRules) walk(anyRule.cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = (sheet as CSSStyleSheet).cssRules;
        readable++;
        walk(rules);
      } catch {
        unreadable++; // cross-origin — no evidence either way
      }
    }

    /* ---- 1.15: is this page English, and what does the copy read like?
     *
     * innerText, NOT textContent: textContent concatenates the source of every
     * inline <script> and <style> too, which on a script-heavy portal buries
     * the real copy under JavaScript. That made an 82%-Arabic page read as
     * English and matched CSS property names ("color", "center") as if they
     * were prose — caught on fnrc.gov.ae before this shipped. */
    const rendered = (document.body as HTMLElement | null)?.innerText ?? "";
    const text = rendered.replace(/\s+/g, " ").slice(0, 120_000);
    const latin = (text.match(/[A-Za-z]/g) ?? []).length;
    const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;

    return {
      lang: document.documentElement.lang || "",
      latinShare: latin + arabic > 0 ? latin / (latin + arabic) : 0,
      textSample: text,
      actions: {
        buttons: buttonEls.length,
        proseLinks: proseLinkEls.length,
        buttonSignature: mode(buttonEls),
        linkSignature: mode(proseLinkEls),
      },
      boxed: { boxed, selector: boxedSel, wrapperWidth, viewport },
      forms: {
        controls: controls.length,
        dlsControls: dlsControls.length,
        example: controls.length
          ? (controls[0].tagName.toLowerCase() +
              (typeof controls[0].className === "string" && controls[0].className
                ? "." + controls[0].className.trim().split(/\s+/)[0]
                : ""))
          : null,
      },
      degradation: {
        noscript: document.querySelectorAll("noscript").length,
        moduleScripts,
        noModuleFallback,
      },
      browserNotice: { found: Boolean(m), text: noticeText },
      css: { readable, unreadable, minWidth, maxWidth },
    };
  })) as DesignScan;
}

/** Minimum og:image the social platforms render without cropping or upscaling. */
const OG_IMAGE_MIN = { width: 1200, height: 630 };

/**
 * 3.63 — the image sizes used by the Open Graph tags. Loaded in the page
 * rather than fetched from Node so cookies, auth and relative URLs resolve
 * exactly as they do for a real visitor.
 */
async function ogImageCheck(page: Page): Promise<{
  finding: AuditFinding | null;
  notApplicable: boolean;
}> {
  const probe = await page.evaluate(async () => {
    const el = document.querySelector('meta[property="og:image" i], meta[name="og:image" i]');
    const src = el?.getAttribute("content")?.trim();
    if (!src) return { state: "absent" as const };
    let url: string;
    try {
      url = new URL(src, location.href).href;
    } catch {
      return { state: "absent" as const };
    }
    return await new Promise<{ state: "ok" | "unloadable"; url: string; w?: number; h?: number }>(
      (resolve) => {
        const img = new Image();
        const done = (state: "ok" | "unloadable") =>
          resolve({ state, url, w: img.naturalWidth, h: img.naturalHeight });
        img.onload = () => done("ok");
        img.onerror = () => done("unloadable");
        setTimeout(() => done("unloadable"), 10_000);
        img.src = url;
      },
    );
  });

  // No og:image at all is dom-og-tags' business (3.36), not this rule's; an
  // image we could not load is no evidence either way.
  if (probe.state !== "ok" || !probe.w || !probe.h) return { finding: null, notApplicable: true };
  if (probe.w >= OG_IMAGE_MIN.width && probe.h >= OG_IMAGE_MIN.height)
    return { finding: null, notApplicable: false };

  return {
    notApplicable: false,
    finding: {
      engine: "dls",
      ruleId: "design-og-image-size",
      severity: "minor",
      confidence: "heuristic",
      message:
        `The og:image is ${probe.w}×${probe.h}, below the ${OG_IMAGE_MIN.width}×${OG_IMAGE_MIN.height} ` +
        `social platforms render without cropping or upscaling — the checklist asks for correct ` +
        `image sizes for the Open Graph tags. Source: ${probe.url}`,
      fix: `Publish the og:image at ${OG_IMAGE_MIN.width}×${OG_IMAGE_MIN.height} or larger, 1.91:1.`,
      helpUrl: null,
      tags: ["aegov-dls", "design", "meta"],
      targets: [probe.url],
      nodeCount: 1,
    },
  };
}

export async function runDesignChecks(
  page: Page,
): Promise<{ findings: AuditFinding[]; notApplicableRules: string[] }> {
  const s = await scan(page);
  const findings: AuditFinding[] = [];
  /**
   * Rules whose anchor was absent on this page. Their items must read "not
   * checked", never "no findings" — a page with no form cannot evidence that
   * its forms use the approved components.
   */
  const notApplicableRules: string[] = [];
  const add = (
    ruleId: string,
    severity: AuditSeverity,
    message: string,
    fix: string,
    targets: string[] = [],
  ) =>
    findings.push({
      engine: "dls",
      ruleId,
      severity,
      confidence: "heuristic",
      message,
      fix,
      helpUrl: null,
      tags: ["aegov-dls", "design"],
      targets,
      nodeCount: Math.max(1, targets.length),
    });

  /* 2.31 — buttons vs hyperlinks. Needs both kinds present to compare. */
  if (!(s.actions.buttons > 0 && s.actions.proseLinks > 0 && s.actions.buttonSignature))
    notApplicableRules.push("design-action-affordance");
  else if (s.actions.buttonSignature === s.actions.linkSignature)
    add(
        "design-action-affordance",
        "moderate",
        `Action buttons and in-text hyperlinks render with the same visual treatment ` +
          `(${s.actions.buttonSignature}) across ${s.actions.buttons} button(s) and ` +
          `${s.actions.proseLinks} prose link(s) — the checklist asks for a clear visual difference ` +
          `between the two, so users can tell an action from a navigation link.`,
      "Give buttons a filled/outlined treatment with padding, and leave hyperlinks underlined text.",
    );

  /* 3.5 — the whole site inside one box */
  if (s.boxed.boxed)
    add(
      "design-site-boxed",
      "moderate",
      `The entire page — header and footer included — sits inside one ${s.boxed.wrapperWidth}px ` +
        `wrapper (${s.boxed.selector}) inside a ${s.boxed.viewport}px viewport. The checklist asks ` +
        `for sections in their own containers rather than the whole website boxed.`,
      "Let sections span the full width and constrain only their inner content containers.",
      s.boxed.selector ? [s.boxed.selector] : [],
    );

  /* 2.33 — form controls from DLS components. No form, nothing to judge. */
  if (s.forms.controls === 0) notApplicableRules.push("design-form-components");
  else if (s.forms.dlsControls === 0)
    add(
      "design-form-components",
      "moderate",
      `None of the ${s.forms.controls} visible form control(s) sit inside a DLS form component ` +
        `(no aegov-* class on the control or its ancestors)` +
        (s.forms.example ? `, e.g. <${s.forms.example}>` : "") +
        " — the checklist asks for form elements built from the approved components.",
      "Rebuild inputs, selects and textareas with the design system's form components.",
      s.forms.example ? [s.forms.example] : [],
    );

  /* 3.44 — graceful degradation */
  if (s.degradation.moduleScripts > 0 && s.degradation.noModuleFallback === 0 && s.degradation.noscript === 0)
    add(
      "design-graceful-degradation",
      "minor",
      `${s.degradation.moduleScripts} ES-module script(s) load with no nomodule fallback and the ` +
        `page has no <noscript> content — a browser that cannot run modules gets nothing.`,
      "Ship a nomodule fallback bundle, or provide <noscript> content for the core task.",
    );

  /* 3.45 — outdated-browser notice.
   *
   * Absence proves nothing: a correct implementation feature-detects and
   * injects the notice ONLY for an unsupported browser, so headless Chromium
   * — a supported browser — sees nothing on a well-built site. Flagging
   * absence would penalise exactly the implementations that got it right.
   * What IS decidable is a notice that exists and names dead browsers. */
  if (!s.browserNotice.found) notApplicableRules.push("design-browser-notice-stale");
  else if (s.browserNotice.text && STALE_BROWSER_YEAR_MARKERS.test(s.browserNotice.text))
    add(
      "design-browser-notice-stale",
      "minor",
      `A browser notice exists but names long-obsolete versions — "${s.browserNotice.text.slice(0, 160)}". ` +
        "A notice pinned to browsers from the early 2010s tells today's users nothing.",
      "Rewrite the notice against currently supported browsers, or feature-detect instead.",
    );

  /* 2.28 — mobile-first CSS. Cross-origin sheets are unreadable by design. */
  if (s.css.readable === 0 || s.css.minWidth + s.css.maxWidth < 4)
    notApplicableRules.push("design-mobile-first");
  else if (s.css.maxWidth > s.css.minWidth * 2)
    add(
      "design-mobile-first",
      "moderate",
      `The readable stylesheets use ${s.css.maxWidth} max-width media query condition(s) against ` +
        `${s.css.minWidth} min-width — desktop-first breakpoints, where a mobile-first approach ` +
        `builds up from the small screen with min-width` +
        (s.css.unreadable ? ` (${s.css.unreadable} cross-origin sheet(s) unreadable)` : "") +
        ".",
      "Author base styles for small screens and layer larger ones with min-width queries.",
    );

  /* 1.15 — British English. Only judgeable on predominantly English copy. */
  if (!(s.latinShare >= 0.8 && (!s.lang || /^en/i.test(s.lang)))) {
    notApplicableRules.push("design-british-english");
  } else {
    const hits: string[] = [];
    for (const [re, british] of AMERICANISMS) {
      const m = s.textSample.match(re);
      if (m) hits.push(`"${m[0]}" → ${british}`);
      if (hits.length >= 6) break;
    }
    if (hits.length)
      add(
        "design-british-english",
        "minor",
        `English copy uses American spelling: ${hits.join(", ")}. The checklist asks for copy ` +
          "following the Oxford Dictionary with British English as the standard.",
        "Switch to British spellings and add a dictionary check to the content workflow.",
        hits,
      );
  }

  /* 3.63 — Open Graph image dimensions */
  const og = await ogImageCheck(page);
  if (og.finding) findings.push(og.finding);
  if (og.notApplicable) notApplicableRules.push("design-og-image-size");

  return { findings, notApplicableRules };
}
