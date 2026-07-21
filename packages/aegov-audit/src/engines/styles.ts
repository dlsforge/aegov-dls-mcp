/**
 * Stage 2B Tier C — rendered checks against the resolved rules-core tokens
 * (STAGE2B-HANDOFF §6 step 3). These answer the checklist's design-guideline
 * items with computed-style facts: 2.2/2.3 approved fonts and heading
 * weights, 2.6 neutral background palette, 2.7 AEBLACK-800 primary text,
 * 2.8 AEGOLD-600 on action elements, 2.9/2.10 contrast sweeps, 2.12
 * ministries-only palette (behind --entity-type ministry), 2.23 icon size.
 *
 * Every palette/typography expectation is read from @dlsforge/aegov-rules-core
 * at run time — never hard-coded hex values (the token model IS the moat).
 * Colour equality happens in canonical sRGB via a canvas probe, because
 * modern Chromium serializes oklch-specified computed colours as oklch()
 * while author styles may be hex/rgb — string comparison would fabricate
 * mismatches between identical colours.
 *
 * Conservative (§9): dominance thresholds, contrast tolerances (the DLS's own
 * white-on-AEGOLD-600 sits at ≈4.50:1 — flagging below 4.45 only), and
 * skip-on-uncertainty (semi-transparent backgrounds, background images).
 */
import { loadCatalog } from "@dlsforge/aegov-rules-core";
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

const TOKENS_DOC = "https://designsystem.gov.ae/docs/getting-started/design-tokens";

/** Scales the colour-system docs treat as neutral (greys/whites). */
const NEUTRAL_SCALES = ["aeblack", "whitely"];
/** Scales that satisfy "AEGOLD as the primary action colour" (primary aliases aegold). */
const GOLD_SCALES = ["aegold", "primary"];

type TokenIn = { name: string; value: string };

type StyleScan = {
  sampledTextChars: number;
  dominantFamily: { family: string; share: number } | null;
  headingIssues: Array<{
    level: string;
    total: number;
    mismatched: number;
    weight: string;
    family: string;
  }>;
  bodyBackground: { css: string; token: string | null } | null;
  primaryText: { css: string; token: string | null; share: number } | null;
  actionGold: { actionCount: number; observed: string[] } | null;
  sectionContrast: Array<{ container: string; sample: string; ratio: number; fg: string; bg: string }>;
  actionContrast: Array<{ desc: string; ratio: number; fg: string; bg: string }>;
  smallIcons: { count: number; samples: Array<{ desc: string; w: number; h: number }> };
  ministry: Array<{ desc: string; scale: string; token: string }>;
};

let cachedData: {
  tokens: TokenIn[];
  approvedFamilies: string[];
  headingWeights: Record<string, number>;
} | null = null;

function catalogData() {
  if (cachedData) return cachedData;
  const catalog = loadCatalog();
  const tokens = catalog.tokens
    .filter((t) => t.category === "color")
    .map((t) => ({ name: t.name, value: t.value }));
  // The approved families are the FIRST family of each --font-* token stack.
  const approvedFamilies = [
    ...new Set(
      catalog.tokens
        .filter((t) => t.category === "font")
        .map((t) => t.value.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase()),
    ),
  ];
  const headingWeights: Record<string, number> = {};
  for (const t of catalog.tokens) {
    const m = t.name.match(/^--text-(h[1-6])-weight$/);
    if (m) headingWeights[m[1]] = Number(t.value);
  }
  return (cachedData = { tokens, approvedFamilies, headingWeights });
}

export async function runStyleChecks(
  page: Page,
  opts: { entityType?: string | null } = {},
): Promise<AuditFinding[]> {
  const { tokens, approvedFamilies, headingWeights } = catalogData();
  const checkMinistry = opts.entityType === "ministry";

  const scan = (await page.evaluate(
    (input: {
      tokens: TokenIn[];
      approvedFamilies: string[];
      headingWeights: Record<string, number>;
      neutralScales: string[];
      goldScales: string[];
      checkMinistry: boolean;
    }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const rgbCache = new Map<string, [number, number, number, number] | null>();
      /** Canonical sRGB via canvas — handles oklch/hex/rgb/named identically. */
      const toRgb = (css: string): [number, number, number, number] | null => {
        if (rgbCache.has(css)) return rgbCache.get(css)!;
        let out: [number, number, number, number] | null = null;
        try {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          out = [d[0], d[1], d[2], d[3]];
        } catch {
          out = null;
        }
        rgbCache.set(css, out);
        return out;
      };
      const key = (rgb: [number, number, number, number]) => `${rgb[0]},${rgb[1]},${rgb[2]}`;

      const scaleOf = (name: string) => name.replace(/^--color-/, "").replace(/-\d+$/, "");
      const tokenByRgb = new Map<string, string[]>();
      for (const t of input.tokens) {
        const rgb = toRgb(t.value);
        if (!rgb || rgb[3] < 250) continue;
        const k = key(rgb);
        tokenByRgb.set(k, [...(tokenByRgb.get(k) ?? []), t.name]);
      }
      const goldKeys = new Set(
        [...tokenByRgb.entries()]
          .filter(([, names]) => names.some((n) => input.goldScales.includes(scaleOf(n))))
          .map(([k]) => k),
      );
      const aeblack800Key = (() => {
        const t = input.tokens.find((x) => x.name === "--color-aeblack-800");
        const rgb = t ? toRgb(t.value) : null;
        return rgb ? key(rgb) : null;
      })();

      const describe = (el: Element) =>
        el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : "") +
        Array.from(el.classList)
          .slice(0, 3)
          .map((c) => `.${c}`)
          .join("");
      const visible = (el: Element) => {
        if (!el.getClientRects().length) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== "hidden" && cs.display !== "none";
      };
      const firstFamily = (fontFamily: string) =>
        (fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();

      /**
       * Effective solid background walking up the tree. Returns null when
       * uncertain (semi-transparent layer or background image on the way up)
       * — uncertain means NO finding, never a guess.
       */
      const effectiveBg = (el: Element): [number, number, number, number] | null => {
        let cur: Element | null = el;
        while (cur) {
          const cs = getComputedStyle(cur);
          if (cs.backgroundImage !== "none") return null;
          const rgb = toRgb(cs.backgroundColor);
          if (!rgb) return null;
          if (rgb[3] >= 250) return rgb;
          if (rgb[3] > 5) return null; // semi-transparent — composite unknown
          cur = cur.parentElement;
        }
        return [255, 255, 255, 255]; // browser default canvas
      };

      const lum = (rgb: [number, number, number, number]) => {
        const f = (c: number) => {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
      };
      const contrast = (a: [number, number, number, number], b: [number, number, number, number]) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };

      /* ---- 2.2 / 2.7: dominant body-text family and colour, text-weighted */
      const textEls = Array.from(document.querySelectorAll("p, li, dd, td, blockquote"))
        .filter((el) => visible(el) && (el.textContent ?? "").trim().length >= 20)
        .slice(0, 300);
      const famWeight = new Map<string, number>();
      const colorWeight = new Map<string, { weight: number; css: string }>();
      let sampledTextChars = 0;
      for (const el of textEls) {
        const len = (el.textContent ?? "").trim().length;
        sampledTextChars += len;
        const cs = getComputedStyle(el);
        const fam = firstFamily(cs.fontFamily);
        famWeight.set(fam, (famWeight.get(fam) ?? 0) + len);
        const rgb = toRgb(cs.color);
        if (rgb && rgb[3] >= 250) {
          const k = key(rgb);
          const cur = colorWeight.get(k);
          if (cur) cur.weight += len;
          else colorWeight.set(k, { weight: len, css: cs.color });
        }
      }
      const domOf = <V extends { weight?: number } | number>(m: Map<string, V>) =>
        [...m.entries()].sort(
          (a, b) =>
            (typeof b[1] === "number" ? b[1] : (b[1].weight ?? 0)) -
            (typeof a[1] === "number" ? a[1] : (a[1].weight ?? 0)),
        )[0];
      let dominantFamily: StyleScan["dominantFamily"] = null;
      if (sampledTextChars >= 200 && famWeight.size) {
        const [fam, w] = domOf(famWeight) as [string, number];
        const share = w / sampledTextChars;
        if (share > 0.6 && !input.approvedFamilies.includes(fam))
          dominantFamily = { family: fam, share };
      }
      let primaryText: StyleScan["primaryText"] = null;
      if (sampledTextChars >= 200 && colorWeight.size && aeblack800Key) {
        const [k, v] = domOf(colorWeight) as [string, { weight: number; css: string }];
        const share = v.weight / sampledTextChars;
        if (share > 0.6 && k !== aeblack800Key)
          primaryText = { css: v.css, token: tokenByRgb.get(k)?.[0] ?? null, share };
      }

      /* ---- 2.3: heading family/weight vs the typography tokens */
      const minHeadingWeight = Math.min(...Object.values(input.headingWeights));
      const headingIssues: StyleScan["headingIssues"] = [];
      for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
        const els = Array.from(document.querySelectorAll(level)).filter(visible).slice(0, 50);
        if (!els.length) continue;
        let mismatched = 0;
        let lastWeight = "";
        let lastFamily = "";
        for (const el of els) {
          const cs = getComputedStyle(el);
          const fam = firstFamily(cs.fontFamily);
          const weight = Number(cs.fontWeight);
          const bad = weight < minHeadingWeight || !input.approvedFamilies.includes(fam);
          if (bad) {
            mismatched++;
            lastWeight = cs.fontWeight;
            lastFamily = fam;
          }
        }
        if (mismatched > els.length / 2)
          headingIssues.push({
            level,
            total: els.length,
            mismatched,
            weight: lastWeight,
            family: lastFamily,
          });
      }

      /* ---- 2.6: body background against the neutral palette */
      let bodyBackground: StyleScan["bodyBackground"] = null;
      const bodyBg = document.body ? effectiveBg(document.body) : null;
      if (bodyBg && !(bodyBg[0] === 255 && bodyBg[1] === 255 && bodyBg[2] === 255)) {
        const names = tokenByRgb.get(key(bodyBg));
        const neutral = names?.some((n) => input.neutralScales.includes(scaleOf(n)));
        if (!neutral) {
          bodyBackground = {
            css: `rgb(${bodyBg[0]}, ${bodyBg[1]}, ${bodyBg[2]})`,
            token: names?.[0] ?? null,
          };
        }
      }

      /* ---- 2.8 / 2.10 / 2.12: action elements */
      const actions = Array.from(
        document.querySelectorAll(
          'button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn" i]',
        ),
      )
        .filter(
          (el) =>
            visible(el) &&
            !el.hasAttribute("disabled") &&
            el.getAttribute("aria-disabled") !== "true",
        )
        .slice(0, 200);
      let anyGold = false;
      const observedActionColors = new Set<string>();
      const actionContrast: StyleScan["actionContrast"] = [];
      const ministry: StyleScan["ministry"] = [];
      const ministrySeen = new Set<string>();
      const okMinistryScale = (s: string) =>
        input.goldScales.includes(s) || input.neutralScales.includes(s) || s === "secondary";
      for (const el of actions) {
        const cs = getComputedStyle(el);
        const parts: Array<[string, string]> = [
          ["background", cs.backgroundColor],
          ["border", cs.borderTopColor],
          ["text", cs.color],
        ];
        for (const [, css] of parts) {
          const rgb = toRgb(css);
          if (!rgb || rgb[3] < 250) continue;
          const k = key(rgb);
          if (goldKeys.has(k)) anyGold = true;
          const names = tokenByRgb.get(k);
          if (names) {
            observedActionColors.add(names[0]);
            if (input.checkMinistry) {
              const offScale = names.map(scaleOf).filter((s) => !okMinistryScale(s));
              // only flag when the colour belongs to NO acceptable scale
              if (offScale.length === names.length && !ministrySeen.has(k) && ministry.length < 10) {
                ministrySeen.add(k);
                ministry.push({ desc: describe(el), scale: offScale[0], token: names[0] });
              }
            }
          } else {
            observedActionColors.add(css);
          }
        }
        // 2.10 — text/background contrast on the action element itself
        const fg = toRgb(cs.color);
        const hasText = (el.textContent ?? "").trim().length > 0 || el.tagName === "INPUT";
        if (fg && fg[3] >= 250 && hasText) {
          const bg = effectiveBg(el);
          if (bg) {
            const ratio = contrast(fg, bg);
            if (ratio < 4.45 && actionContrast.length < 10)
              actionContrast.push({
                desc: describe(el),
                ratio: Math.round(ratio * 100) / 100,
                fg: cs.color,
                bg: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,
              });
          }
        }
      }
      const actionGold: StyleScan["actionGold"] =
        actions.length >= 1 && !anyGold
          ? { actionCount: actions.length, observed: [...observedActionColors].slice(0, 8) }
          : null;

      /* ---- 2.9: section-level background/foreground at 3:1 */
      const sectionContrast: StyleScan["sectionContrast"] = [];
      const containers = Array.from(
        document.querySelectorAll('section, header, footer, main, aside, nav, article, [class*="aegov-"]'),
      )
        .filter(visible)
        .slice(0, 100);
      for (const c of containers) {
        const cs = getComputedStyle(c);
        if (cs.backgroundImage !== "none") continue;
        const bg = toRgb(cs.backgroundColor);
        if (!bg || bg[3] < 250) continue;
        const texts = Array.from(c.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, a, span, label"))
          .filter((el) => visible(el) && (el.textContent ?? "").trim().length >= 10)
          .slice(0, 20);
        for (const t of texts) {
          const tBg = effectiveBg(t);
          if (!tBg || key(tBg) !== key(bg)) continue; // text sits on a nested background
          const fg = toRgb(getComputedStyle(t).color);
          if (!fg || fg[3] < 250) continue;
          const ratio = contrast(fg, bg);
          if (ratio < 2.95 && sectionContrast.length < 10) {
            sectionContrast.push({
              container: describe(c),
              sample: describe(t),
              ratio: Math.round(ratio * 100) / 100,
              fg: getComputedStyle(t).color,
              bg: cs.backgroundColor,
            });
          }
        }
      }

      /* ---- 2.23: rendered icon size */
      const iconEls = Array.from(
        document.querySelectorAll(
          'svg, i[class*="icon" i], span[class*="icon" i], i[class^="fa-"], i[class*=" fa-"], [class*="material-icons"]',
        ),
      ).filter(visible);
      const small: Array<{ desc: string; w: number; h: number }> = [];
      let smallCount = 0;
      for (const el of iconEls) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.width < 23.5 || r.height < 23.5) {
          smallCount++;
          if (small.length < 10)
            small.push({
              desc: describe(el),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
        }
      }

      return {
        sampledTextChars,
        dominantFamily,
        headingIssues,
        bodyBackground,
        primaryText,
        actionGold,
        sectionContrast,
        actionContrast,
        smallIcons: { count: smallCount, samples: small },
        ministry,
      } as StyleScan;
    },
    { tokens, approvedFamilies, headingWeights, neutralScales: NEUTRAL_SCALES, goldScales: GOLD_SCALES, checkMinistry },
  )) as StyleScan;

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
      helpUrl: TOKENS_DOC,
      tags: ["aegov-dls", "styles", "tier-c"],
      targets: targets.slice(0, 10),
      nodeCount,
    });

  if (scan.dominantFamily)
    add(
      "style-font-family",
      "moderate",
      `The dominant body-text font family is "${scan.dominantFamily.family}" ` +
        `(${Math.round(scan.dominantFamily.share * 100)}% of sampled text) — not one of the DLS ` +
        `font tokens (${approvedFamilies.join(", ")}).`,
      "Use the DLS font tokens (Inter/Roboto for Latin, Noto Kufi Arabic/Alexandria for Arabic).",
    );
  if (scan.headingIssues.length) {
    const detail = scan.headingIssues
      .map(
        (h) =>
          `${h.level} (${h.mismatched}/${h.total} rendered at weight ${h.weight}` +
          (approvedFamilies.includes(h.family) ? "" : `, family "${h.family}"`) +
          `; token says weight ${headingWeights[h.level]})`,
      )
      .join("; ");
    add(
      "style-heading-typography",
      "minor",
      `Headings deviate from the DLS typography tokens: ${detail}. The heading tokens specify ` +
        `weights ${Object.entries(headingWeights)
          .map(([l, w]) => `${l}=${w}`)
          .join(" ")} in the heading font family.`,
      "Style headings with the DLS heading utilities so family and weight come from the tokens.",
      scan.headingIssues.map((h) => h.level),
      scan.headingIssues.reduce((n, h) => n + h.mismatched, 0),
    );
  }
  if (scan.bodyBackground)
    add(
      "style-background-neutral",
      "moderate",
      scan.bodyBackground.token
        ? `The page background resolves to DLS token ${scan.bodyBackground.token} ` +
          `(${scan.bodyBackground.css}) — not a neutral-palette colour (aeblack/whitely scales or white), ` +
          `which the checklist asks for as the background.`
        : `The page background computes to ${scan.bodyBackground.css}, which matches no DLS colour ` +
          `token — the checklist asks for the neutral palette as the background colour.`,
      "Use white or a neutral-scale token (aeblack/whitely) for page backgrounds.",
      ["body"],
    );
  if (scan.primaryText)
    add(
      "style-text-primary",
      "moderate",
      `The dominant body-text colour computes to ${scan.primaryText.css}` +
        (scan.primaryText.token ? ` (DLS token ${scan.primaryText.token})` : " (no DLS token match)") +
        ` across ${Math.round(scan.primaryText.share * 100)}% of sampled text — the checklist asks for ` +
        `AEBLACK-800 as the primary text colour.`,
      "Set primary body text to the aeblack-800 token.",
      ["body"],
    );
  if (scan.actionGold)
    add(
      "style-action-gold",
      "moderate",
      `None of the ${scan.actionGold.actionCount} action element(s) on the page use AEGOLD-600 (or any ` +
        `aegold-scale token) for background, border or text — the checklist asks for AEGOLD-600 as the ` +
        `primary action colour. Observed action colours: ${scan.actionGold.observed.join(", ") || "(none resolvable)"}.`,
      "Style primary actions (buttons, CTAs) with the aegold-600 token.",
    );
  for (const hit of scan.sectionContrast)
    add(
      "style-section-contrast",
      "moderate",
      `Text in <${hit.container}> has a ${hit.ratio}:1 contrast ratio against the section background ` +
        `(${hit.fg} on ${hit.bg}, e.g. <${hit.sample}>) — below the checklist's 3:1 requirement for ` +
        `section background/foreground usage.`,
      "Raise the contrast between the section background and its foreground content to at least 3:1.",
      [hit.container, hit.sample],
    );
  for (const hit of scan.actionContrast)
    add(
      "style-action-contrast",
      "moderate",
      `Action element <${hit.desc}> has a ${hit.ratio}:1 text/background contrast ratio ` +
        `(${hit.fg} on ${hit.bg}) — below the checklist's 4.5:1 requirement for action elements.`,
      "Adjust the action element's colours to reach 4.5:1 (the DLS token pairs meet this).",
      [hit.desc],
    );
  if (scan.smallIcons.count > 0)
    add(
      "style-icon-size",
      "minor",
      `${scan.smallIcons.count} icon(s) render below the checklist's 24px minimum (e.g. ` +
        scan.smallIcons.samples
          .slice(0, 5)
          .map((s) => `<${s.desc}> at ${s.w}×${s.h}px`)
          .join(", ") +
        `) — the checklist asks for a minimum of 24px in width and height for all icons.`,
      "Render icons at 24px or larger (icon-size utilities), or use larger source glyphs.",
      scan.smallIcons.samples.map((s) => s.desc),
      scan.smallIcons.count,
    );
  for (const hit of scan.ministry)
    add(
      "ministry-palette",
      "moderate",
      `--entity-type ministry: <${hit.desc}> uses DLS token ${hit.token} (the "${hit.scale}" support ` +
        `palette) on an action element — the checklist restricts ministries to AEGOLD and AEBLACK as ` +
        `primary colours.`,
      "For ministry sites, keep primary/action colours to the aegold and aeblack scales.",
      [hit.desc],
    );

  return findings;
}
