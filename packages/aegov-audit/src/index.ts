#!/usr/bin/env node
/**
 * @dlsforge/aegov-audit — Mizan (ميزان), the AEGOV DLS compliance auditor.
 *
 * STAGE2-HANDOFF §6 step 1: prove the smallest thing first — load a target
 * URL or local file in a real browser (Playwright Chromium) and report the
 * rendered DOM size. The audit engines (axe-core, Lighthouse, the DLS rules
 * from @dlsforge/aegov-rules-core) attach to this rendered page in later
 * build steps.
 *
 * Community project. Not affiliated with or endorsed by TDRA.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const USAGE = `Mizan — AEGOV DLS compliance auditor (early scaffold)

Usage: aegov-audit <url|path>

  <url|path>   A http(s):// URL or a local HTML file to load.

Loads the target in headless Chromium and prints the rendered node count —
the foundation the audit engines run on. Not an audit yet.`;

function targetToUrl(arg: string): string {
  if (/^https?:\/\//i.test(arg)) return arg;
  const abs = resolve(arg);
  if (!existsSync(abs)) {
    console.error(`aegov-audit: target not found: ${arg}`);
    process.exit(2);
  }
  return pathToFileURL(abs).href;
}

const arg = process.argv[2];
if (!arg || arg === "--help" || arg === "-h") {
  console.log(USAGE);
  process.exit(arg ? 0 : 2);
}

const url = targetToUrl(arg);
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
  console.log(
    `loaded ${url}\n` +
      `  status ${status}, ${nodes} nodes in ${Date.now() - started}ms\n` +
      `  title: ${title}\n` +
      `  lang=${lang} dir=${dir}`,
  );
  if (status >= 400) process.exit(1);
} finally {
  await browser.close();
}
