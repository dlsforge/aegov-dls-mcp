/**
 * Token fidelity over computed styles (STAGE2-HANDOFF §6 step 4) — completes
 * Stage 1 known-limit T4, which validate_snippet could not do without a
 * rendered page.
 *
 * Two tiers of evidence, kept honestly apart:
 *  - INLINE hard-coded values (style="color:#ff0000") on aegov-* elements —
 *    unambiguous authored arbitrary values: serious.
 *  - COMPUTED colors on aegov-* elements that resolve to no DLS token value —
 *    a review flag, not a verdict (docs examples legitimately mix Tailwind
 *    utilities, so this can have benign causes): moderate.
 *
 * The DLS palette ships as oklch() strings; the browser itself converts them
 * to computed rgb() via a probe element, so comparison is exact — no color
 * math in our code.
 */
import { loadCatalog } from "@dlsforge/aegov-rules-core";
import type { Page } from "playwright";
import type { AuditFinding } from "../report/types.js";

let cachedColors: string[] | null = null;
function tokenColorValues(): string[] {
  return (cachedColors ??= loadCatalog()
    .tokens.filter((t) => t.category === "color")
    .map((t) => t.value));
}

type InPageResult = {
  inline: Array<{ desc: string; style: string }>;
  nonToken: Array<{ color: string; property: string; count: number; sample: string }>;
  scanned: number;
};

export async function runTokenFidelity(page: Page): Promise<AuditFinding[]> {
  const result = (await page.evaluate((tokenValues: string[]) => {
    // Resolve every token color to this browser's computed rgb serialization.
    const probe = document.createElement("div");
    document.documentElement.appendChild(probe);
    const palette = new Set<string>();
    for (const v of tokenValues) {
      probe.style.color = "";
      probe.style.color = v;
      if (probe.style.color) palette.add(getComputedStyle(probe).color);
    }
    probe.remove();

    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      Array.from(el.classList)
        .slice(0, 3)
        .map((c) => `.${c}`)
        .join("");

    const els = Array.from(
      document.querySelectorAll('[class*="aegov-"]'),
    ).slice(0, 2000);
    const inline: Array<{ desc: string; style: string }> = [];
    const nonTokenMap = new Map<string, { count: number; sample: string; property: string }>();

    // Only DESIGN properties count as token violations. JS libraries
    // legitimately write positioning inline (popper tooltips, animation:
    // transform/inset/translate) — flagging those would fabricate failures.
    const designProp =
      /^(color|background(-color)?|border(-color)?|outline-color|box-shadow|text-decoration-color|font(-family|-size)?|line-height|letter-spacing|border-radius|gap|(padding|margin)(-(top|right|bottom|left|inline|block).*)?)$/;
    // Zero is unit-agnostic (popper et al. write margin: 0px while
    // positioning) — only NON-zero pixel values are arbitrary design values.
    const arbitraryValue = /#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(|\b(?!0(\.0+)?px\b)\d+(\.\d+)?px\b/i;

    for (const el of els) {
      const style = el.getAttribute("style") ?? "";
      const offending = style
        .split(";")
        .map((d) => d.split(":"))
        .filter(
          ([prop, ...v]) =>
            prop && designProp.test(prop.trim().toLowerCase()) && arbitraryValue.test(v.join(":")),
        )
        .map((d) => d.join(":").trim());
      if (offending.length && inline.length < 10) {
        inline.push({ desc: describe(el), style: offending.join("; ").slice(0, 120) });
      }
      const cs = getComputedStyle(el);
      for (const property of ["color", "background-color"] as const) {
        const value = cs.getPropertyValue(property);
        if (!value || value === "rgba(0, 0, 0, 0)" || value === "transparent") continue;
        if (!palette.has(value)) {
          const key = `${property}:${value}`;
          const cur = nonTokenMap.get(key);
          if (cur) cur.count++;
          else nonTokenMap.set(key, { count: 1, sample: describe(el), property });
        }
      }
    }
    return {
      inline,
      nonToken: Array.from(nonTokenMap.entries())
        .map(([key, v]) => ({ color: key.split(":").slice(1).join(":"), ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      scanned: els.length,
    } as InPageResult;
  }, tokenColorValues())) as InPageResult;

  const findings: AuditFinding[] = [];
  for (const hit of result.inline) {
    findings.push({
      engine: "dls",
      ruleId: "dls-token-inline-style",
      severity: "serious",
      confidence: "heuristic",
      message:
        `Hard-coded inline style on a DLS component (<${hit.desc}> style="${hit.style}") — ` +
        `use DLS tokens/utility classes, never arbitrary values.`,
      fix: "Replace the inline value with the matching DLS token utility class.",
      helpUrl: "https://designsystem.gov.ae/docs/getting-started/design-tokens",
      tags: ["aegov-dls", "tokens", "T4"],
      targets: [hit.desc],
      nodeCount: 1,
    });
  }
  for (const hit of result.nonToken) {
    findings.push({
      engine: "dls",
      ruleId: "dls-token-color",
      severity: "moderate",
      confidence: "heuristic",
      message:
        `Computed ${hit.property} ${hit.color} on ${hit.count} DLS element(s) (e.g. <${hit.sample}>) ` +
        `resolves to no DLS colour token — review whether this is an arbitrary override ` +
        `(docs examples legitimately mix Tailwind utilities, so confirm before acting).`,
      fix: null,
      helpUrl: "https://designsystem.gov.ae/docs/getting-started/design-tokens",
      tags: ["aegov-dls", "tokens", "T4"],
      targets: [hit.sample],
      nodeCount: hit.count,
    });
  }
  return findings;
}
