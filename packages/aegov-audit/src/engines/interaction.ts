/**
 * Stage 2B Tier C — interaction checks (STAGE2B-HANDOFF §6 step 3, built last
 * within the tier per §9 because they are the flakiest surface):
 *
 *  - 2.38 layout at 175% zoom: shrink the viewport to width/1.75 (the CSS
 *    geometry browser zoom produces) and measure horizontal overflow.
 *  - 3.13 keyboard reach: a bounded real-Tab walk; a region (header/nav,
 *    main, footer) with interactive elements none of which ever receive
 *    focus is flagged — but ONLY when the walk completed a full cycle, so a
 *    truncated walk can never fabricate "unreachable".
 *  - 3.14 focus indication: every element visited by the walk is checked for
 *    a visible focus style — UA/author outline, or any focused-vs-blurred
 *    delta in box-shadow/background/border/text-decoration (element or
 *    ::after/::before), read 350 ms after blur so transitions settle.
 *
 * Fail-soft contract: any error returns ran=false and NO findings; the
 * checklist view then reports 3.13/3.14 as "not checked" rather than flaking
 * a false answer (§9: skip, never guess).
 */
import type { Page } from "playwright";
import type { AuditFinding } from "../report/types.js";

const ZOOM_FACTOR = 1.75;
const MAX_STEPS = 300;

/**
 * The responsive breakpoints the design system compiles against (checklist
 * 3.42). Verified 2026-07-22 from the installed toolchain: the DLS plugin
 * (@aegov/design-system 3.0.7) defines NO screen overrides anywhere in the
 * package, so the effective breakpoints are Tailwind's — read from
 * tailwindcss@4.3.1 theme.css (--breakpoint-sm…2xl, rem×16). A drift test
 * re-checks these against the installed tailwindcss when present.
 */
export const DLS_BREAKPOINTS: ReadonlyArray<{ name: string; width: number }> = [
  { name: "sm", width: 640 },
  { name: "md", width: 768 },
  { name: "lg", width: 1024 },
  { name: "xl", width: 1280 },
  { name: "2xl", width: 1536 },
];

export async function runZoomCheck(page: Page): Promise<AuditFinding[]> {
  const vp = page.viewportSize();
  if (!vp) return [];
  try {
    const overflowNow = () =>
      page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth - d.clientWidth;
      });
    const baseOverflow = await overflowNow();
    const zoomed = { width: Math.round(vp.width / ZOOM_FACTOR), height: Math.round(vp.height / ZOOM_FACTOR) };
    await page.setViewportSize(zoomed);
    await page.waitForTimeout(400);
    const overflow = await overflowNow();
    await page.setViewportSize(vp);
    await page.waitForTimeout(100);
    if (overflow > 8) {
      return [
        {
          engine: "dls",
          ruleId: "ix-zoom-overflow",
          severity: "moderate",
          confidence: "heuristic",
          message:
            `At 175% zoom (emulated as a ${zoomed.width}px-wide viewport from the ${vp.width}px base) ` +
            `the layout overflows horizontally by ${overflow}px — zoomed-in users must scroll in two ` +
            `dimensions to read content.` +
            (baseOverflow > 8 ? ` The layout already overflows by ${baseOverflow}px at the base viewport.` : ""),
          fix: "Make the layout reflow at narrow widths (fluid containers, wrapping grids, max-width: 100% media).",
          helpUrl: null,
          tags: ["aegov-dls", "interaction", "tier-c"],
          targets: ["html"],
          nodeCount: 1,
        },
      ];
    }
    return [];
  } catch {
    try {
      await page.setViewportSize(vp);
    } catch {
      /* page gone — nothing to restore */
    }
    return [];
  }
}

/**
 * Stage 2C — 3.42 (+ partial 3.15): render the page at each design-system
 * breakpoint and flag clear horizontal overflow. Same conservative overflow
 * test as the zoom check (>8px), so a fluid layout can never be flagged.
 */
export async function runBreakpointCheck(page: Page): Promise<AuditFinding[]> {
  const vp = page.viewportSize();
  if (!vp) return [];
  try {
    const overflowing: Array<{ name: string; width: number; overflow: number }> = [];
    for (const bp of DLS_BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: vp.height });
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth - d.clientWidth;
      });
      if (overflow > 8) overflowing.push({ name: bp.name, width: bp.width, overflow });
    }
    await page.setViewportSize(vp);
    await page.waitForTimeout(100);
    if (!overflowing.length) return [];
    return [
      {
        engine: "dls",
        ruleId: "ix-breakpoint-overflow",
        severity: "moderate",
        confidence: "heuristic",
        message:
          `The layout overflows horizontally at ${overflowing.length} of ${DLS_BREAKPOINTS.length} ` +
          `design-system breakpoints: ` +
          overflowing.map((o) => `${o.name} (${o.width}px: +${o.overflow}px)`).join(", ") +
          `. The checklist asks for testing at the design system's responsive breakpoints; ` +
          `overflow forces two-dimensional scrolling on those screens.`,
        fix: "Make the layout reflow at every breakpoint (fluid containers, wrapping grids, max-width: 100% media).",
        helpUrl: null,
        tags: ["aegov-dls", "interaction", "tier-2c"],
        targets: overflowing.map((o) => `${o.width}px`),
        nodeCount: overflowing.length,
      },
    ];
  } catch {
    try {
      await page.setViewportSize(vp);
    } catch {
      /* page gone — nothing to restore */
    }
    return [];
  }
}

/** The canvas and container widths checklist item 2.26 names by number. */
const CANVAS_WIDTH = 1536;
const CONTAINER_WIDTH = 1480;
/** Container measurement tolerance: padding legitimately trims a few px. */
const CONTAINER_TOLERANCE = 48;

/**
 * 2.26 — the 1536px canvas and 1480px container, measured on the built page.
 *
 * 2.4 (responsive typography) deliberately has NO rule: nothing in the design
 * system defines a threshold for "responsive" type, and the item asks whether
 * the design process planned for it. Flagging a fixed type size would be an
 * opinion wearing a standard's clothes.
 */
export async function runResponsiveDesignChecks(
  page: Page,
): Promise<{ findings: AuditFinding[]; notApplicableRules: string[] }> {
  const vp = page.viewportSize();
  const findings: AuditFinding[] = [];
  const notApplicableRules: string[] = [];
  if (!vp) return { findings, notApplicableRules: ["design-canvas-container"] };

  const sample = async () =>
    page.evaluate(() => {
      const px = (v: string) => parseFloat(v) || 0;
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const dominant = (sel: string) => {
        const counts = new Map<number, number>();
        for (const el of Array.from(document.querySelectorAll(sel)).filter(visible).slice(0, 40)) {
          const size = Math.round(px(getComputedStyle(el).fontSize) * 100) / 100;
          counts.set(size, (counts.get(size) ?? 0) + 1);
        }
        let best: number | null = null;
        let n = 0;
        for (const [k, v] of counts) if (v > n) ((best = k), (n = v));
        return best;
      };
      // The site's content container: the widest element that is deliberately
      // constrained (an author-set max-width), not merely narrow by accident.
      let container = 0;
      for (const el of Array.from(document.body?.querySelectorAll("*") ?? []).slice(0, 4000)) {
        const cs = getComputedStyle(el);
        if (cs.maxWidth === "none" || !cs.maxWidth) continue;
        const w = el.getBoundingClientRect().width;
        if (w > container) container = w;
      }
      return {
        body: dominant("p"),
        heading: dominant("h1, h2"),
        container: Math.round(container),
      };
    });

  try {
    await page.setViewportSize({ width: 640, height: vp.height });
    await page.waitForTimeout(350);
    const small = await sample();
    await page.setViewportSize({ width: CANVAS_WIDTH, height: vp.height });
    await page.waitForTimeout(350);
    const large = await sample();
    await page.setViewportSize(vp);
    await page.waitForTimeout(100);

    /* 2.26 — the container at the 1536px canvas */
    if (!large.container) {
      notApplicableRules.push("design-canvas-container");
    } else if (Math.abs(large.container - CONTAINER_WIDTH) > CONTAINER_TOLERANCE) {
      findings.push({
        engine: "dls",
        ruleId: "design-canvas-container",
        severity: "minor",
        confidence: "heuristic",
        message:
          `At the ${CANVAS_WIDTH}px canvas the widest constrained container renders ` +
          `${large.container}px wide, against the ${CONTAINER_WIDTH}px the checklist names ` +
          `(±${CONTAINER_TOLERANCE}px allowed for padding). This measures the built page; it does ` +
          `not speak to whether the wireframes used that canvas.`,
        fix: `Set the content container to ${CONTAINER_WIDTH}px within a ${CANVAS_WIDTH}px canvas.`,
        helpUrl: null,
        tags: ["aegov-dls", "interaction", "design"],
        targets: [`${large.container}px`],
        nodeCount: 1,
      });
    }
  } catch {
    try {
      await page.setViewportSize(vp);
    } catch {
      /* page gone — nothing to restore */
    }
    return { findings: [], notApplicableRules: ["design-canvas-container"] };
  }

  return { findings, notApplicableRules };
}

type WalkAnalysis = {
  wrapped: boolean;
  steps: number;
  inventory: Record<string, number>;
  reachedRegions: string[];
  noIndicator: Array<{ desc: string; region: string }>;
  visited: number;
};

export async function runKeyboardChecks(
  page: Page,
): Promise<{ findings: AuditFinding[]; ran: boolean }> {
  try {
    const inventoryTotal = await page.evaluate(() => {
      const visible = (el: Element) => {
        if (!el.getClientRects().length) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== "hidden" && cs.display !== "none";
      };
      const regionOf = (el: Element) =>
        el.closest("header, nav") ? "header/nav" : el.closest("main") ? "main" : el.closest("footer") ? "footer" : "other";
      const interactive = Array.from(
        document.querySelectorAll(
          'a[href], button, input, select, textarea, summary, [tabindex]',
        ),
      ).filter((el) => {
        if (!visible(el) || el.hasAttribute("disabled") || el.getAttribute("type") === "hidden")
          return false;
        // A non-native element with tabindex="-1" (e.g. a skip-link target
        // <div>) is not an interactive control — but a NATIVE control with
        // tabindex="-1" stays in the inventory: that is 3.13 evidence.
        const native = el.matches("a[href], button, input, select, textarea, summary");
        const ti = el.getAttribute("tabindex");
        if (!native && ti !== null && Number(ti) < 0) return false;
        return true;
      });
      const inventory: Record<string, number> = {};
      for (const el of interactive) {
        // tabindex="-1" elements are still part of the region's interactive
        // inventory (a mouse can click them) — that is exactly what 3.13 asks.
        const r = regionOf(el);
        inventory[r] = (inventory[r] ?? 0) + 1;
      }
      // Elements Tab can actually stop on. Radio groups expose only one stop
      // per group — count groups once so "visited everything" is reachable.
      const radioGroups = new Set<string>();
      let tabbable = 0;
      for (const el of interactive) {
        const ti = el.getAttribute("tabindex");
        if (ti !== null && Number(ti) < 0) continue;
        if (el instanceof HTMLInputElement && el.type === "radio" && el.name) {
          radioGroups.add(el.name);
          continue;
        }
        tabbable++;
      }
      tabbable += radioGroups.size;
      const w = {
        order: [] as Element[],
        seen: new Set<Element>(),
        focusStyles: [] as Array<Record<string, string>>,
        bodyStreak: 0,
        inventory,
        tabbable,
      };
      (window as unknown as Record<string, unknown>).__mizanKbd = w;
      return interactive.length;
    });
    if (inventoryTotal === 0) return { findings: [], ran: true };

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    const maxSteps = Math.min(MAX_STEPS, inventoryTotal * 2 + 25);
    let wrapped = false;
    let steps = 0;
    for (; steps < maxSteps; steps++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const w = (window as unknown as Record<string, unknown>).__mizanKbd as {
          order: Element[];
          seen: Set<Element>;
          focusStyles: Array<Record<string, string>>;
          bodyStreak: number;
        };
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) {
          w.bodyStreak++;
          return { stop: w.bodyStreak >= 3, wrapped: false };
        }
        w.bodyStreak = 0;
        if (w.seen.has(el)) return { stop: true, wrapped: true };
        w.seen.add(el);
        w.order.push(el);
        const snap = (pseudo: string | null) => {
          const cs = getComputedStyle(el, pseudo);
          return {
            [`${pseudo ?? ""}outlineStyle`]: cs.outlineStyle,
            [`${pseudo ?? ""}outlineWidth`]: cs.outlineWidth,
            [`${pseudo ?? ""}boxShadow`]: cs.boxShadow,
            [`${pseudo ?? ""}backgroundColor`]: cs.backgroundColor,
            [`${pseudo ?? ""}borderColor`]: cs.borderTopColor,
            [`${pseudo ?? ""}textDecoration`]: cs.textDecorationLine,
            [`${pseudo ?? ""}opacity`]: cs.opacity,
          };
        };
        w.focusStyles.push({ ...snap(null), ...snap("::after"), ...snap("::before") });
        return { stop: false, wrapped: false };
      });
      if (state.stop) {
        wrapped = state.wrapped;
        break;
      }
    }

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.waitForTimeout(350); // let focus-style transitions settle

    const analysis = (await page.evaluate((walkWrapped: boolean) => {
      const w = (window as unknown as Record<string, unknown>).__mizanKbd as {
        order: Element[];
        focusStyles: Array<Record<string, string>>;
        inventory: Record<string, number>;
        tabbable: number;
      };
      const describe = (el: Element) =>
        el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : "") +
        Array.from(el.classList)
          .slice(0, 3)
          .map((c) => `.${c}`)
          .join("");
      const regionOf = (el: Element) =>
        el.closest("header, nav") ? "header/nav" : el.closest("main") ? "main" : el.closest("footer") ? "footer" : "other";
      const reached = new Set<string>();
      const noIndicator: Array<{ desc: string; region: string }> = [];
      w.order.forEach((el, i) => {
        reached.add(regionOf(el));
        const f = w.focusStyles[i];
        const hasOutline = f["outlineStyle"] !== "none" && parseFloat(f["outlineWidth"]) > 0;
        if (hasOutline) return;
        const snap = (pseudo: string | null) => {
          const cs = getComputedStyle(el, pseudo);
          return {
            [`${pseudo ?? ""}outlineStyle`]: cs.outlineStyle,
            [`${pseudo ?? ""}outlineWidth`]: cs.outlineWidth,
            [`${pseudo ?? ""}boxShadow`]: cs.boxShadow,
            [`${pseudo ?? ""}backgroundColor`]: cs.backgroundColor,
            [`${pseudo ?? ""}borderColor`]: cs.borderTopColor,
            [`${pseudo ?? ""}textDecoration`]: cs.textDecorationLine,
            [`${pseudo ?? ""}opacity`]: cs.opacity,
          };
        };
        const blurred = { ...snap(null), ...snap("::after"), ...snap("::before") };
        const changed = Object.keys(f).some((k) => f[k] !== blurred[k]);
        if (!changed && noIndicator.length < 10) noIndicator.push({ desc: describe(el), region: regionOf(el) });
      });
      return {
        // "complete" either by revisiting an element (a true cycle) or by
        // having stopped on every tabbable stop the page offers — headless
        // Tab order can exit via the body instead of cycling.
        wrapped: walkWrapped || w.order.length >= w.tabbable,
        steps: w.order.length,
        inventory: w.inventory,
        reachedRegions: [...reached],
        noIndicator,
        visited: w.order.length,
      };
    }, wrapped)) as WalkAnalysis;

    const findings: AuditFinding[] = [];
    if (analysis.wrapped) {
      for (const region of ["header/nav", "main", "footer"]) {
        const count = analysis.inventory[region] ?? 0;
        if (count > 0 && !analysis.reachedRegions.includes(region)) {
          findings.push({
            engine: "dls",
            ruleId: "kbd-region-unreachable",
            severity: "serious",
            confidence: "heuristic",
            message:
              `A full keyboard tab cycle (${analysis.visited} stops) never reached the ${region} region, ` +
              `although it contains ${count} interactive element(s) — keyboard-only users cannot operate it.`,
            fix: "Remove focus traps / tabindex=\"-1\" from operable controls so every region is keyboard-reachable.",
            helpUrl: null,
            tags: ["aegov-dls", "interaction", "tier-c"],
            targets: [region],
            nodeCount: count,
          });
        }
      }
    }
    if (analysis.noIndicator.length) {
      findings.push({
        engine: "dls",
        ruleId: "kbd-focus-indicator",
        severity: "serious",
        confidence: "heuristic",
        message:
          `${analysis.noIndicator.length} of ${analysis.visited} keyboard-focused element(s) show no ` +
          `visible focus indication (no outline and no focused-vs-blurred style change, including ` +
          `::before/::after): ` +
          analysis.noIndicator
            .slice(0, 5)
            .map((n) => `<${n.desc}> in ${n.region}`)
            .join(", ") +
          `. The checklist requires a focus state on every action element.`,
        fix: "Never remove outlines without a replacement — style :focus-visible on all interactive elements.",
        helpUrl: null,
        tags: ["aegov-dls", "interaction", "tier-c"],
        targets: analysis.noIndicator.map((n) => n.desc).slice(0, 10),
        nodeCount: analysis.noIndicator.length,
      });
    }
    return { findings, ran: true };
  } catch {
    return { findings: [], ran: false };
  }
}
