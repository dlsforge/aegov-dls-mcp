#!/usr/bin/env node
/**
 * @dlsforge/aegov-audit — Mizan (ميزان), the AEGOV DLS compliance auditor.
 *
 * All engines are wired (STAGE2-HANDOFF §6 steps 1–5): Playwright renders the
 * page; axe-core, Lighthouse, the shared DLS rules from
 * @dlsforge/aegov-rules-core, token fidelity, structure, UAE Pass, document
 * meta and Arabic/RTL parity feed one normalized finding stream; the report
 * layer mirrors the official TDRA assessment checklist v2.0. --fail-on gives
 * CI (the GitHub Action wrapper, step 6) its exit-code gate.
 *
 * Community project. Not affiliated with or endorsed by TDRA.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { runAxe, AXE_VERSION } from "./engines/axe.js";
import { runDlsRules, dlsPackageRef } from "./engines/dls.js";
import { runTokenFidelity } from "./engines/tokens.js";
import { runStructureChecks } from "./engines/structure.js";
import { runUaePassCheck } from "./engines/uaepass.js";
import { runMetaChecks } from "./engines/meta.js";
import { runAssetChecks } from "./engines/assets.js";
import { runMediaChecks } from "./engines/media.js";
import { runHttpChecks } from "./engines/http.js";
import { runStyleChecks } from "./engines/styles.js";
import { runZoomCheck, runKeyboardChecks, runBreakpointCheck } from "./engines/interaction.js";
import { runCrawlChecks, CRAWL_CAP } from "./engines/crawl.js";
import { runStackChecks } from "./engines/stack.js";
import { runHtmlValidation } from "./engines/validate-html.js";
import { writeArtifacts } from "./artifacts.js";
import { runParityCheck, discoverAlternate } from "./engines/parity.js";
import { settleNavigation } from "./engines/settle.js";
import { runLighthouseBoth, type LighthouseScores } from "./engines/lighthouse.js";
import { deriveLighthouseFindings } from "./engines/lighthouse-findings.js";
import {
  countAtOrAbove,
  countBySeverity,
  isFailOn,
  type AuditFinding,
  type FailOn,
} from "./report/types.js";
import { buildReport, renderMarkdown } from "./report/report.js";
import { fillWorkbook, resolveTemplate } from "./report/xlsx.js";

const USAGE = `Mizan — AEGOV DLS compliance auditor

Usage: aegov-audit <url|path> [--json] [--lighthouse] [--parity [url]] [--out <dir>]
                   [--format xlsx [--xlsx-template <path>]] [--no-crawl]
                   [--entity-type <type>]
                   [--fail-on <critical|serious|moderate|minor|none>]

  <url|path>     A http(s):// URL or a local HTML file to audit.
  --json         Emit the full machine report as JSON on stdout.
  --lighthouse   Also run Lighthouse (mobile + desktop category scores and
                 LCP/FCP, evaluated against the verified TDRA thresholds
                 under LOCAL run conditions; slower — two full page loads).
  --parity [url] Also load the other-language variant (given URL, or
                 discovered via <link hreflang>) and flag structural
                 differences for human review.
  --out <dir>    Write report.json + report.md (shaped to mirror the official
                 TDRA assessment checklist v2.0) into <dir>.
  --format xlsx  Additionally write report.xlsx into --out <dir>: a COPY of
                 TDRA's own assessment workbook with the "Reason" column
                 pre-filled with Mizan's evidence. The "Validate" column is
                 never touched — that answer belongs to the entity.
  --xlsx-template <path>
                 Use a local copy of the TDRA workbook as the template
                 (default: the cached copy, else a fresh download).
  --no-crawl     Skip the bounded same-origin crawl (home + up to ${CRAWL_CAP}
                 linked pages; on by default for http(s) targets). The crawl
                 answers the multi-page checklist items (unique titles,
                 per-page hreflang, Page Rating presence) and honours
                 robots.txt.
  --entity-type <type>
                 The audited entity's type. "ministry" additionally enables
                 checklist item 2.12 (ministries-only AEGOLD/AEBLACK primary
                 palette); other values change nothing yet.
  --artifacts <dir>
                 Write a deterministic evidence bundle into <dir>: full-page
                 screenshots at the default viewport and every design-system
                 breakpoint, the extracted page copy (copy.json), an image
                 inventory (images.json) and a manifest. Evidence input for
                 downstream review tooling — never a compliance verdict.
  --fail-on <s>  Exit 1 when any finding is at or above severity <s>
                 (critical > serious > moderate > minor). Default: none —
                 report only. This is what CI (the GitHub Action) keys off.

Loads the target in headless Chromium and runs axe-core (WCAG) plus the
AEGOV DLS rules — the shared rules-core checks, token fidelity, component
structure, and UAE Pass presence — over the rendered DOM. A clean run is
NOT full compliance: automated checks cover a machine-checkable subset,
and Arabic parity is always flagged for native-speaker review, never
asserted. Lighthouse scores are evaluated against the verified TDRA
thresholds strictly under the local-run caveat.`;

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
const parityIdx = args.indexOf("--parity");
const withParity = parityIdx !== -1;
const consumed = new Set<number>();
let parityUrl: string | null = null;
if (withParity && args[parityIdx + 1] && !args[parityIdx + 1].startsWith("--")) {
  parityUrl = args[parityIdx + 1];
  consumed.add(parityIdx + 1);
}
const failIdx = args.indexOf("--fail-on");
let failOn: FailOn = "none";
if (failIdx !== -1) {
  const v = args[failIdx + 1];
  if (!v || !isFailOn(v)) {
    console.error("aegov-audit: --fail-on needs one of critical|serious|moderate|minor|none");
    process.exit(2);
  }
  failOn = v;
  consumed.add(failIdx + 1);
}
const outIdx = args.indexOf("--out");
let outDir: string | null = null;
if (outIdx !== -1) {
  if (!args[outIdx + 1] || args[outIdx + 1].startsWith("--")) {
    console.error("aegov-audit: --out needs a directory argument");
    process.exit(2);
  }
  outDir = args[outIdx + 1];
  consumed.add(outIdx + 1);
}
const formatIdx = args.indexOf("--format");
let wantXlsx = false;
if (formatIdx !== -1) {
  const v = args[formatIdx + 1];
  if (v !== "xlsx") {
    console.error('aegov-audit: --format supports only "xlsx" (json/md always write with --out)');
    process.exit(2);
  }
  wantXlsx = true;
  consumed.add(formatIdx + 1);
  if (outIdx === -1) {
    console.error("aegov-audit: --format xlsx needs --out <dir> for the output file");
    process.exit(2);
  }
}
const noCrawl = args.includes("--no-crawl");
const entityIdx = args.indexOf("--entity-type");
let entityType: string | null = null;
if (entityIdx !== -1) {
  const v = args[entityIdx + 1];
  if (!v || v.startsWith("--")) {
    console.error("aegov-audit: --entity-type needs a value (e.g. ministry)");
    process.exit(2);
  }
  entityType = v.toLowerCase();
  consumed.add(entityIdx + 1);
  if (entityType !== "ministry")
    console.error(
      `aegov-audit: --entity-type ${entityType}: only "ministry" changes behaviour today (checklist 2.12)`,
    );
}
const artifactsIdx = args.indexOf("--artifacts");
let artifactsDir: string | null = null;
if (artifactsIdx !== -1) {
  if (!args[artifactsIdx + 1] || args[artifactsIdx + 1].startsWith("--")) {
    console.error("aegov-audit: --artifacts needs a directory argument");
    process.exit(2);
  }
  artifactsDir = args[artifactsIdx + 1];
  consumed.add(artifactsIdx + 1);
}
const tplIdx = args.indexOf("--xlsx-template");
let xlsxTemplate: string | null = null;
if (tplIdx !== -1) {
  if (!args[tplIdx + 1] || args[tplIdx + 1].startsWith("--")) {
    console.error("aegov-audit: --xlsx-template needs a file path");
    process.exit(2);
  }
  xlsxTemplate = args[tplIdx + 1];
  consumed.add(tplIdx + 1);
}
const target = args.find((a, i) => !a.startsWith("--") && !consumed.has(i));
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
  const loadMs = Date.now() - started;
  // Local files never redirect — skip the settle there to keep evals fast.
  if (/^https?:/i.test(url)) await settleNavigation(page);
  const pageInfo = () =>
    page.evaluate(() => ({
      nodes: document.querySelectorAll("*").length,
      title: document.title,
      lang: document.documentElement.lang || "(unset)",
      dir: document.documentElement.dir || "(unset)",
    }));
  const { nodes, title, lang, dir } = await pageInfo().catch(async (err) => {
    if (!String(err).includes("Execution context was destroyed")) throw err;
    await page.waitForLoadState("load", { timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    return pageInfo();
  });
  const finalUrl = page.url();

  const axeFindings = await runAxe(page);
  const dlsFindings: AuditFinding[] = [
    ...(await runDlsRules(page)),
    ...(await runTokenFidelity(page)),
    ...(await runStructureChecks(page)),
    ...(await runUaePassCheck(page)),
    ...(await runMetaChecks(page)),
    ...(await runAssetChecks(page)),
    ...(await runMediaChecks(page)),
    ...(await runHttpChecks(finalUrl)),
    ...(await runStyleChecks(page, { entityType })),
    ...(await runStackChecks(page)),
  ];
  const htmlValidation = await runHtmlValidation(finalUrl);
  dlsFindings.push(...htmlValidation.findings);
  // Keyboard walk and viewport emulation mutate focus/viewport — run them
  // after the DOM-reading engines, then the crawl (which opens its own pages).
  const kbd = await runKeyboardChecks(page);
  dlsFindings.push(...kbd.findings);
  dlsFindings.push(...(await runZoomCheck(page)));
  dlsFindings.push(...(await runBreakpointCheck(page)));
  let crawl: { findings: AuditFinding[]; pagesCrawled: number } = { findings: [], pagesCrawled: 0 };
  if (!noCrawl && /^https?:/i.test(finalUrl)) {
    crawl = await runCrawlChecks(browser, page, finalUrl);
    console.error(
      `aegov-audit: crawl covered ${crawl.pagesCrawled} subpage(s) (cap ${CRAWL_CAP}, robots.txt honoured)` +
        (crawl.pagesCrawled === 0 ? " — multi-page items will show as not checked" : ""),
    );
    dlsFindings.push(...crawl.findings);
  }
  if (artifactsDir) {
    const manifest = await writeArtifacts(page, artifactsDir, { target: url, finalUrl });
    console.error(
      `aegov-audit: wrote evidence bundle to ${resolve(artifactsDir)} ` +
        `(${manifest.screenshots.length} screenshot(s), copy.json, images.json, manifest.json)`,
    );
  }
  if (withParity) {
    const alternate = parityUrl ?? (await discoverAlternate(page));
    if (!alternate) {
      console.error(
        "aegov-audit: --parity: no alternate URL given and none discoverable via <link hreflang>",
      );
    } else {
      dlsFindings.push(...(await runParityCheck(browser, page, targetToUrl(alternate))));
    }
  }
  let lighthouse: LighthouseScores[] | null = null;
  if (withLighthouse) {
    if (!/^https?:/.test(url)) {
      console.error("aegov-audit: --lighthouse needs an http(s) URL (file:// is not scoreable)");
    } else {
      lighthouse = await runLighthouseBoth(url);
    }
  }
  const lighthouseFindings = lighthouse ? deriveLighthouseFindings(lighthouse) : [];
  const findings = [...axeFindings, ...dlsFindings, ...lighthouseFindings];

  const report = buildReport({
    target: url,
    page: { status, loadMs, nodes, title, lang, dir, finalUrl },
    engines: { axe: AXE_VERSION, dls: dlsPackageRef() },
    findings,
    lighthouse,
    crawlRan: crawl.pagesCrawled > 0,
    kbdRan: kbd.ran,
    ministryChecked: entityType === "ministry",
    htmlValidateRan: htmlValidation.ran,
  });

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(resolve(outDir, "report.md"), renderMarkdown(report));
    console.error(`aegov-audit: wrote ${resolve(outDir, "report.json")} and report.md`);
    if (wantXlsx) {
      const template = await resolveTemplate(xlsxTemplate);
      writeFileSync(resolve(outDir, "report.xlsx"), fillWorkbook(template, report));
      console.error(
        `aegov-audit: wrote ${resolve(outDir, "report.xlsx")} — TDRA workbook copy, ` +
          `"Reason" column pre-filled; "Validate" column untouched (the entity answers it)`,
      );
    }
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `loaded ${url}${finalUrl !== url ? ` → ${finalUrl}` : ""}\n` +
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
        "  Scores are evaluated against the verified TDRA thresholds under LOCAL run " +
          "conditions (see the report) — not comparable to TDRA's environment.",
      );
      if (lighthouseFindings.length) {
        console.log(`  ${lighthouseFindings.length} checklist finding(s) derived from audits:`);
        for (const f of lighthouseFindings) {
          console.log(`  [${f.severity}|${f.confidence}] ${f.ruleId} — ${f.message}`);
        }
      }
    }
    const c = report.tdraChecklist;
    const flagged = c.machineCheckedItems.filter((i) => i.status === "findings");
    console.log(
      `\nTDRA checklist v${c.source.version}: ${flagged.length} of ${c.machineCheckedItems.length} ` +
        `machine-checked items have findings (${flagged.map((i) => i.id).join(", ") || "none"}); ` +
        `${c.humanReviewCount} of ${c.totalItems} items need human review. ` +
        `Use --out <dir> for the full reviewer-shaped report.`,
    );
    console.log(
      "\nNote: automated checks cover only a machine-checkable subset of WCAG — " +
        "a clean run is not compliance.",
    );
  }
  if (failOn !== "none") {
    const above = countAtOrAbove(report.summary.bySeverity, failOn);
    if (above > 0) {
      console.error(
        `aegov-audit: FAIL — ${above} finding(s) at or above "${failOn}" (--fail-on ${failOn})`,
      );
      process.exitCode = 1;
    }
  }
  if (status >= 400) process.exitCode = 1;
} finally {
  await browser.close();
}
