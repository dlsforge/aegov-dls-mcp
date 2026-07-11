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
import { countBySeverity } from "./report/types.js";

const USAGE = `Mizan — AEGOV DLS compliance auditor (early scaffold)

Usage: aegov-audit <url|path> [--json]

  <url|path>   A http(s):// URL or a local HTML file to audit.
  --json       Emit the normalized findings as JSON on stdout.

Loads the target in headless Chromium and runs axe-core (WCAG) over the
rendered DOM. A clean run is NOT full WCAG compliance — automated checks
cover only a machine-checkable subset. Lighthouse and the AEGOV DLS rules
engine are wired in later build steps.`;

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

  const findings = await runAxe(page);

  if (json) {
    console.log(
      JSON.stringify(
        {
          target: url,
          status,
          loadMs,
          page: { nodes, title, lang, dir },
          engines: { axe: AXE_VERSION },
          findings,
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
    const counts = countBySeverity(findings);
    console.log(
      `axe-core ${AXE_VERSION}: ${findings.length} violation(s) — ` +
        `${counts.critical} critical, ${counts.serious} serious, ` +
        `${counts.moderate} moderate, ${counts.minor} minor`,
    );
    for (const f of findings) {
      console.log(`  [${f.severity}] ${f.ruleId} — ${f.message} (${f.nodeCount} node(s))`);
      if (f.targets[0]) console.log(`      e.g. ${f.targets[0]}`);
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
