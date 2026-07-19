/**
 * Lighthouse over the target URL (STAGE2-HANDOFF §6 step 3) — the four
 * category scores TDRA's assessment uses: Performance, Accessibility,
 * Best Practices, SEO, on both mobile and desktop form factors.
 *
 * NO thresholds are asserted here. The provisional TDRA numbers (≥90/≥80)
 * must be re-verified against the real assessment document before any
 * pass/fail claim (STAGE2-HANDOFF §8) — until then Mizan reports scores,
 * not verdicts.
 *
 * Run conditions matter (§8): scores depend on machine, network, throttling
 * and emulation, so every result carries an explicit runConditions block.
 * These local runs use Lighthouse's DEFAULT simulated throttling — they are
 * comparable to each other, not to TDRA's environment.
 */
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { launch as launchChrome } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const require = createRequire(import.meta.url);
const lhPkg = require("lighthouse/package.json") as { version: string };

export const LIGHTHOUSE_VERSION: string = lhPkg.version;

export type FormFactor = "mobile" | "desktop";

/**
 * The audit ids Stage 2B reads for TDRA checklist evidence (items 3.43, 3.46,
 * 3.47, 3.53, 3.54, 3.58). Verified against the INSTALLED Lighthouse — v13
 * replaced the legacy audits (render-blocking-resources, uses-long-cache-ttl,
 * third-party-summary) with *-insight ids, and dropped offscreen-images
 * entirely (3.50 is a DOM check instead). Re-verify on every Lighthouse bump.
 */
export const PICKED_AUDIT_IDS = [
  "render-blocking-insight",
  "unminified-css",
  "unminified-javascript",
  "cache-insight",
  "total-byte-weight",
  "resource-summary",
  "third-parties-insight",
] as const;

export type PickedAudit = {
  id: string;
  score: number | null;
  scoreDisplayMode: string;
  numericValue: number | null;
  displayValue: string | null;
  /** resource-summary only: resourceType → transferSize (bytes). */
  resourceSizes?: Record<string, number>;
};

export type LighthouseScores = {
  formFactor: FormFactor;
  /** 0-100 per category, null when Lighthouse could not score it. */
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  /** Load-time metrics (ms) — the TDRA page states LCP ≤ 2.5 s, FCP ≤ 1.8 s. */
  metrics: {
    largestContentfulPaintMs: number | null;
    firstContentfulPaintMs: number | null;
  };
  /** Subset of lhr.audits used for checklist evidence (keyed by audit id). */
  audits: Record<string, PickedAudit>;
  runConditions: {
    lighthouseVersion: string;
    formFactor: FormFactor;
    throttling: string;
    screenEmulation: string;
    chromePath: string;
    chromeFlags: string;
    note: string;
  };
};

function pct(score: number | null | undefined): number | null {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

/** One Lighthouse run. Launches its own headless Chromium (Playwright's binary). */
export async function runLighthouse(
  url: string,
  formFactor: FormFactor,
): Promise<LighthouseScores> {
  // CHROME_PATH lets CI point at a system Chrome; default stays Playwright's
  // pinned Chromium so local runs are reproducible.
  const chromePath = process.env.CHROME_PATH || chromium.executablePath();
  const chromeFlags = ["--headless=new", "--no-first-run"];
  if (process.platform === "linux" && process.env.CI) {
    // Linux CI runners (GitHub's ubuntu-24.04+) restrict unprivileged user
    // namespaces, which kills the raw Chromium sandbox before the debug port
    // opens (ECONNREFUSED). Disable it only there — and it is recorded in the
    // report's run conditions.
    chromeFlags.push("--no-sandbox");
  }
  const chrome = await launchChrome({ chromePath, chromeFlags });
  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
      formFactor === "desktop" ? desktopConfig : undefined,
    );
    if (!result) throw new Error(`Lighthouse returned no result for ${url}`);
    const cats = result.lhr.categories;
    const throttling = result.lhr.configSettings.throttlingMethod;
    const screen = result.lhr.configSettings.screenEmulation;
    const audits: Record<string, PickedAudit> = {};
    for (const id of PICKED_AUDIT_IDS) {
      const a = result.lhr.audits[id];
      if (!a) continue; // absent audit = no evidence, never a guess
      const picked: PickedAudit = {
        id,
        score: typeof a.score === "number" ? a.score : null,
        scoreDisplayMode: a.scoreDisplayMode,
        numericValue: typeof a.numericValue === "number" ? a.numericValue : null,
        displayValue: a.displayValue ?? null,
      };
      if (id === "resource-summary") {
        const items = (a.details as { items?: Array<Record<string, unknown>> } | undefined)?.items;
        if (Array.isArray(items)) {
          picked.resourceSizes = {};
          for (const row of items) {
            if (typeof row.resourceType === "string" && typeof row.transferSize === "number")
              picked.resourceSizes[row.resourceType] = row.transferSize;
          }
        }
      }
      audits[id] = picked;
    }
    return {
      formFactor,
      scores: {
        performance: pct(cats["performance"]?.score),
        accessibility: pct(cats["accessibility"]?.score),
        bestPractices: pct(cats["best-practices"]?.score),
        seo: pct(cats["seo"]?.score),
      },
      metrics: {
        largestContentfulPaintMs:
          (result.lhr.audits["largest-contentful-paint"]?.numericValue as number | undefined) ??
          null,
        firstContentfulPaintMs:
          (result.lhr.audits["first-contentful-paint"]?.numericValue as number | undefined) ??
          null,
      },
      audits,
      runConditions: {
        lighthouseVersion: LIGHTHOUSE_VERSION,
        formFactor,
        throttling: `${throttling} (Lighthouse default for ${formFactor})`,
        screenEmulation: screen.disabled
          ? "disabled"
          : `${screen.width}x${screen.height}@${screen.deviceScaleFactor}${screen.mobile ? " mobile" : ""}`,
        chromePath,
        chromeFlags: chromeFlags.join(" "),
        note:
          "Local run under Lighthouse default simulated throttling — comparable across " +
          "local runs, NOT to TDRA's environment. TDRA thresholds are not asserted; " +
          "verify the current assessment criteria before claiming alignment.",
      },
    };
  } finally {
    try {
      chrome.kill();
    } catch {
      // Windows: chrome-launcher's kill() rm-s its temp profile while Chrome
      // may still hold it (EPERM). Losing a temp dir must not fail the audit;
      // the OS temp cleaner reclaims it.
    }
  }
}

/** Both form factors, sequentially (parallel runs distort performance scores). */
export async function runLighthouseBoth(url: string): Promise<LighthouseScores[]> {
  const mobile = await runLighthouse(url, "mobile");
  const desktop = await runLighthouse(url, "desktop");
  return [mobile, desktop];
}
