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

export type LighthouseScores = {
  formFactor: FormFactor;
  /** 0-100 per category, null when Lighthouse could not score it. */
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  runConditions: {
    lighthouseVersion: string;
    formFactor: FormFactor;
    throttling: string;
    screenEmulation: string;
    chromePath: string;
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
  const chromePath = chromium.executablePath();
  const chrome = await launchChrome({
    chromePath,
    chromeFlags: ["--headless=new", "--no-first-run"],
  });
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
    return {
      formFactor,
      scores: {
        performance: pct(cats["performance"]?.score),
        accessibility: pct(cats["accessibility"]?.score),
        bestPractices: pct(cats["best-practices"]?.score),
        seo: pct(cats["seo"]?.score),
      },
      runConditions: {
        lighthouseVersion: LIGHTHOUSE_VERSION,
        formFactor,
        throttling: `${throttling} (Lighthouse default for ${formFactor})`,
        screenEmulation: screen.disabled
          ? "disabled"
          : `${screen.width}x${screen.height}@${screen.deviceScaleFactor}${screen.mobile ? " mobile" : ""}`,
        chromePath,
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
