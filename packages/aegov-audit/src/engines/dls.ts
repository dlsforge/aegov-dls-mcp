/**
 * The DLS rules engine over the rendered DOM (STAGE2-HANDOFF §6 step 4) —
 * the differentiating value generic tools cannot provide.
 *
 * Consistency rule (§7): these are the SAME checks the MCP server's
 * validate_snippet enforces, imported from @dlsforge/aegov-rules-core —
 * never re-derived. A rule changes once in the core and both tools follow.
 *
 * This first slice runs the string-level rule engine over the serialized
 * rendered DOM (what Stage 1 could never see: the post-JavaScript document).
 * The rendered-only checks — token fidelity via computed styles (T4),
 * structural nesting (T5), UAE Pass presence, Arabic/RTL parity — layer on
 * top in later work; see the build log in STAGE2-HANDOFF §6.
 */
import {
  loadCatalog,
  buildClassIndex,
  checkClassIdentity,
  checkImgAlt,
  checkButtonType,
  checkFullEidValue,
  checkEmiratesIdInputs,
  checkMdyDates,
  type ClassIndex,
  type Finding,
} from "@dlsforge/aegov-rules-core";
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

let cachedIndex: ClassIndex | null = null;
function classIndex(): ClassIndex {
  return (cachedIndex ??= buildClassIndex(loadCatalog()));
}

export function dlsPackageRef(): string {
  return classIndex().packageRef;
}

/** Stage 1 finding levels → Mizan severities. */
function severityOf(level: Finding["level"]): AuditSeverity {
  switch (level) {
    case "error":
      return "serious";
    case "warning":
      return "moderate";
    default:
      return "minor";
  }
}

/** A rendered gov page can carry thousands of unverified utility classes. */
function truncate(message: string, max = 500): string {
  return message.length <= max ? message : `${message.slice(0, max)}… (truncated)`;
}

export async function runDlsRules(page: Page): Promise<AuditFinding[]> {
  const index = classIndex();
  const html = (await page.evaluate(
    () => document.documentElement.outerHTML,
  )) as string;

  const checks: Array<[string, Finding[]]> = [
    ["dls-class-identity", checkClassIdentity(html, index).findings],
    ["dls-img-alt", checkImgAlt(html)],
    ["dls-button-type", checkButtonType(html)],
    ["dls-eid-unmasked", checkFullEidValue(html)],
    ["dls-eid-pattern", checkEmiratesIdInputs(html)],
    ["dls-dmy-dates", checkMdyDates(html)],
  ];

  // A full rendered page can repeat one defect dozens of times (fnrc.gov.ae:
  // 79 alt-less <img> instances, 44 of them byte-identical). A manual expert
  // review lists the defect once with its extent — mirror that: up to
  // MAX_PER_RULE distinct instances (identical messages collapse into their
  // count), then one rollup carrying the remainder.
  const MAX_PER_RULE = 10;
  const findings: AuditFinding[] = [];
  for (const [ruleId, ruleFindings] of checks) {
    const byMessage = new Map<string, { finding: (typeof ruleFindings)[number]; count: number }>();
    for (const f of ruleFindings) {
      const cur = byMessage.get(f.message);
      if (cur) cur.count++;
      else byMessage.set(f.message, { finding: f, count: 1 });
    }
    const distinct = [...byMessage.values()];
    for (const { finding: f, count } of distinct.slice(0, MAX_PER_RULE)) {
      findings.push({
        engine: "dls",
        ruleId,
        severity: severityOf(f.level),
        confidence: f.confidence,
        message: truncate(count > 1 ? `${f.message} (×${count} occurrences)` : f.message),
        fix: null,
        helpUrl: null,
        tags: ["aegov-dls", index.packageRef],
        targets: [],
        nodeCount: count,
      });
    }
    const rest = distinct.slice(MAX_PER_RULE);
    if (rest.length) {
      const restCount = rest.reduce((n, r) => n + r.count, 0);
      findings.push({
        engine: "dls",
        ruleId,
        severity: severityOf(rest[0].finding.level),
        confidence: rest[0].finding.confidence,
        message:
          `…and ${restCount} more occurrence(s) of this rule across ${rest.length} further ` +
          `distinct instance(s) — the ${MAX_PER_RULE} above are a sample, not the full extent.`,
        fix: null,
        helpUrl: null,
        tags: ["aegov-dls", index.packageRef],
        targets: [],
        nodeCount: restCount,
      });
    }
  }
  // Site-level signal a manual reviewer states first (step-7 blind-review
  // diff): whether the page uses the official DLS at all. "Official
  // components over hand-rolled equivalents" is a §7 non-negotiable; a page
  // with zero aegov-* classes is almost certainly not built on the DLS.
  const aegovElementCount = (await page.evaluate(
    () => document.querySelectorAll('[class*="aegov-"]').length,
  )) as number;
  if (aegovElementCount === 0) {
    findings.push({
      engine: "dls",
      ruleId: "dls-not-used",
      severity: "serious",
      confidence: "heuristic",
      message:
        `No AEGOV Design Language System components detected on this page (zero aegov-* ` +
        `classes) — the UI appears hand-rolled or built on a third-party framework. The ` +
        `standard requires official DLS components and tokens over hand-rolled equivalents. ` +
        `Review whether this page is in scope for the DLS.`,
      fix: "Adopt @aegov/design-system components and tokens for the page's UI.",
      helpUrl: "https://designsystem.gov.ae/",
      tags: ["aegov-dls", index.packageRef],
      targets: ["html"],
      nodeCount: 1,
    });
  }
  findings.push(...(await runArabicRtlRendered(page, index.packageRef)));
  findings.push(...(await runPlaceholderAltRendered(page, index.packageRef)));
  return findings;
}

/**
 * Placeholder alt text (step-7 eval refinement, found live on fnrc.gov.ae:
 * alt="Alternate Text" ×6 and alt="Image Placeholder" ×16 shipped to
 * production). checkImgAlt and axe's image-alt only catch MISSING alt — an
 * alt that is a CMS placeholder or a filename passes both while conveying
 * nothing. Conservative list; review flag, not a verdict.
 */
async function runPlaceholderAltRendered(page: Page, packageRef: string): Promise<AuditFinding[]> {
  const hits = (await page.evaluate(() => {
    const placeholders = new Set([
      "alternate text",
      "image placeholder",
      "placeholder",
      "image",
      "img",
      "photo",
      "picture",
      "untitled",
      "temp",
    ]);
    const filename = /\.(png|jpe?g|gif|svg|webp)\s*$/i;
    const out: Array<{ alt: string; src: string; count: number }> = [];
    const byAlt = new Map<string, { src: string; count: number }>();
    for (const img of Array.from(document.querySelectorAll("img[alt]"))) {
      const alt = (img.getAttribute("alt") ?? "").trim();
      if (!alt) continue; // empty alt = declared decorative; axe/manual review owns that call
      if (!placeholders.has(alt.toLowerCase()) && !filename.test(alt)) continue;
      const cur = byAlt.get(alt);
      if (cur) cur.count++;
      else byAlt.set(alt, { src: (img.getAttribute("src") ?? "").slice(0, 80), count: 1 });
    }
    for (const [alt, v] of byAlt) out.push({ alt, ...v });
    return out.slice(0, 10);
  })) as Array<{ alt: string; src: string; count: number }>;

  return hits.map((hit) => ({
    engine: "dls" as const,
    ruleId: "dls-img-alt-placeholder",
    severity: "moderate" as const,
    confidence: "heuristic" as const,
    message:
      `alt="${hit.alt}" on ${hit.count} image(s) (e.g. src="${hit.src}") looks like a CMS ` +
      `placeholder or filename, not a description — it passes automated alt checks while ` +
      `conveying nothing (WCAG 1.1.1). Review and replace with real alternative text.`,
    fix: "Write alternative text that describes the image's content or function; use alt=\"\" only for purely decorative images.",
    helpUrl: null,
    tags: ["aegov-dls", packageRef, "img-alt"],
    targets: [hit.src],
    nodeCount: hit.count,
  }));
}

/**
 * Arabic-without-RTL, ancestor-aware (step-7 eval refinement). The core's
 * string-level checkArabicRtl is right for snippets — its own message defers
 * to "an ancestor element already establishing RTL", which a snippet cannot
 * see. The rendered DOM can: an element's Arabic text is fine when its
 * COMPUTED direction is rtl, or when it is a short, explicitly lang="ar"
 * -tagged inline island (the standard language-switcher link — pure-Arabic
 * runs render correctly under the Unicode bidi algorithm). Everything else
 * stays a review flag. Same rule as the core, ancestor condition resolved.
 */
async function runArabicRtlRendered(page: Page, packageRef: string): Promise<AuditFinding[]> {
  const hits = (await page.evaluate(() => {
    const arabic = /[؀-ۿ]/;
    const out: Array<{ desc: string; sample: string }> = [];
    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      Array.from(el.classList)
        .slice(0, 3)
        .map((c) => `.${c}`)
        .join("");
    for (const el of Array.from(document.querySelectorAll("body, body *"))) {
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("")
        .trim();
      if (!arabic.test(ownText)) continue;
      if (getComputedStyle(el).direction === "rtl") continue;
      const langHost = el.closest("[lang]") as HTMLElement | null;
      const isTaggedInlineIsland =
        !!langHost && langHost.lang.toLowerCase().startsWith("ar") && ownText.length <= 50;
      if (isTaggedInlineIsland) continue;
      if (out.length < 10) out.push({ desc: describe(el), sample: ownText.slice(0, 60) });
    }
    return out;
  })) as Array<{ desc: string; sample: string }>;

  return hits.map((hit) => ({
    engine: "dls" as const,
    ruleId: "dls-arabic-rtl",
    severity: "moderate" as const,
    confidence: "heuristic" as const,
    message:
      `Arabic text renders in an LTR context (<${hit.desc}> "${hit.sample}") with no dir="rtl" ` +
      `in scope and no explicit lang="ar" inline tagging — RTL is first-class in the standard; ` +
      `review the direction handling.`,
    fix: 'Establish dir="rtl" on the Arabic content (or tag a short inline island with lang="ar").',
    helpUrl: null,
    tags: ["aegov-dls", packageRef, "arabic-rtl"],
    targets: [hit.desc],
    nodeCount: 1,
  }));
}
