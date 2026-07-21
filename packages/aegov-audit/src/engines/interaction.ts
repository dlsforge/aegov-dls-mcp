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
