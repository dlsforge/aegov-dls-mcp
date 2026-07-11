#!/usr/bin/env node
/**
 * @dlsforge/aegov-audit — Mizan (ميزان), the AEGOV DLS compliance auditor.
 *
 * Build state (STAGE2-HANDOFF §6): step 1 (Playwright loads the rendered
 * page) and step 2 (axe-core → normalized WCAG findings) are wired.
 * Lighthouse scores and the DLS rules engine from @dlsforge/aegov-rules-core
 * attach next.
 *
 * Community project. Not affiliated with or endorsed by TDRA.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runAxe, AXE_VERSION } from "./engines/axe.js";
import { runDlsRules, dlsPackageRef } from "./engines/dls.js";
import { runLighthouseBoth, type LighthouseScores } from "./engines/lighthouse.js";
import { countBySeverity } from "./report/types.js";

const USAGE = `Mizan — AEGOV DLS compliance auditor (early scaffold)

Usage: aegov-audit <url|path> [--json] [--lighthouse]

  <url|path>    A http(s):// URL or a local HTML file to audit.
  --json        Emit the normalized findings as JSON on stdout.
  --lighthouse  Also run Lighthouse (mobile + desktop category scores;
                slower — two full page loads under simulated throttling).

Loads the target in headless Chromium and runs axe-core (WCAG) over the
rendered DOM. A clean run is NOT full WCAG compliance — automated checks
cover only a machine-checkable subset. Lighthouse scores are reported
without thresholds until the current TDRA assessment criteria are verified.
The AEGOV DLS rules engine is wired in the next build step.`;

function targetToUrl(arg: string): string {
  if (/^https?:\/\//i.test(arg)) return arg;
  const abs = resolve(arg);
  if (!existsSync(abs)) {
    console.error(`aegov-audit: target not found: ${arg}`);
    process.exit(2);
  }
  return pathToFileURL(abs).href;
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const withLighthouse = args.includes("--lighthouse");
const target = args.find((a) => !a.startsWith("--"));
if (!target || args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(target ? 0 : 2);
}

const url = targetToUrl(target);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const started = Date.now();
  const response = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  const status = response?.status() ?? 0;
  const { nodes, title, lang, dir } = await page.evaluate(() => ({
    nodes: document.querySelectorAll("*").length,
    title: document.title,
    lang: document.documentElement.lang || "(unset)",
    dir: document.documentElement.dir || "(unset)",
  }));
  const loadMs = Date.now() - started;

  const axeFindings = await runAxe(page);
  const dlsFindings = await runDlsRules(page);
  const findings = [...axeFindings, ...dlsFindings];

  let lighthouse: LighthouseScores[] | null = null;
  if (withLighthouse) {
    if (!/^https?:/.test(url)) {
      console.error("aegov-audit: --lighthouse needs an http(s) URL (file:// is not scoreable)");
    } else {
      lighthouse = await runLighthouseBoth(url);
    }
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          target: url,
          status,
          loadMs,
          page: { nodes, title, lang, dir },
          engines: { axe: AXE_VERSION, dls: dlsPackageRef() },
          findings,
          lighthouse,
          note:
            "Automated checks cover only a machine-checkable subset of WCAG — " +
            "a clean run is not compliance.",
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `loaded ${url}\n` +
        `  status ${status}, ${nodes} nodes in ${loadMs}ms\n` +
        `  title: ${title}\n` +
        `  lang=${lang} dir=${dir}\n`,
    );
    const counts = countBySeverity(axeFindings);
    console.log(
      `axe-core ${AXE_VERSION}: ${axeFindings.length} violation(s) — ` +
        `${counts.critical} critical, ${counts.serious} serious, ` +
        `${counts.moderate} moderate, ${counts.minor} minor`,
    );
    for (const f of axeFindings) {
      console.log(`  [${f.severity}] ${f.ruleId} — ${f.message} (${f.nodeCount} node(s))`);
      if (f.targets[0]) console.log(`      e.g. ${f.targets[0]}`);
    }

    const dlsCounts = countBySeverity(dlsFindings);
    console.log(
      `\nDLS rules (${dlsPackageRef()}, shared with validate_snippet): ` +
        `${dlsFindings.length} finding(s) — ${dlsCounts.serious} serious, ` +
        `${dlsCounts.moderate} moderate, ${dlsCounts.minor} minor`,
    );
    for (const f of dlsFindings) {
      console.log(`  [${f.severity}|${f.confidence}] ${f.ruleId} — ${f.message}`);
    }
    if (lighthouse) {
      console.log("");
      for (const run of lighthouse) {
        const s = run.scores;
        console.log(
          `lighthouse ${run.runConditions.lighthouseVersion} (${run.formFactor}): ` +
            `performance ${s.performance ?? "n/a"}, accessibility ${s.accessibility ?? "n/a"}, ` +
            `best-practices ${s.bestPractices ?? "n/a"}, seo ${s.seo ?? "n/a"}`,
        );
        console.log(
          `  conditions: ${run.runConditions.throttling}; screen ${run.runConditions.screenEmulation}`,
        );
      }
      console.log(
        "  Scores are local-run numbers, not TDRA verdicts — thresholds are not asserted " +
          "until the current assessment criteria are verified.",
      );
    }
    console.log(
      "\nNote: automated checks cover only a machine-checkable subset of WCAG — " +
        "a clean run is not compliance.",
    );
  }
  if (status >= 400) process.exit(1);
} finally {
  await browser.close();
}
