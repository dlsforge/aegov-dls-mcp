/**
 * The DLS rule engine — every UAE-specific check DLSForge tools enforce,
 * as pure functions over an HTML string (extracted verbatim from Stage 1's
 * validate_snippet per STAGE2-HANDOFF.md §6 step 0).
 *
 * Two callers share these: the MCP server's validate_snippet (source strings)
 * and Mizan, the auditor (rendered DOM, serialized). A rule changes here once
 * and both tools follow.
 *
 * Confidence is tiered (STAGE1-HANDOFF.md §10.3):
 *  - package: aegov-* class identity is verified against the pinned
 *    @aegov/design-system version — certain.
 *  - docs: non-aegov classes are compared against usage in official docs
 *    examples — best-effort evidence, not proof (Tailwind utilities cannot be
 *    enumerated from the catalogue).
 *  - heuristic: structural/accessibility/UAE checks on the raw markup.
 *
 * Findings: error = violates the standard (invalid class, missing alt,
 * unmasked/unvalidated Emirates ID), warning = likely violation needing human
 * judgement, info = context the assistant should know.
 */
import type { Catalog } from "../catalog/types.js";

// Matches class="…", class='…', and the HTML5-valid unquoted class=… form
// (third group) — an unquoted attribute must not slip past class validation.
const CLASS_ATTR_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

export type Finding = {
  level: "error" | "warning" | "info";
  confidence: "package" | "docs" | "heuristic";
  message: string;
};

export type ClassBuckets = {
  packageVerified: string[];
  seenInDocsExamples: string[];
  unverified: string[];
};

/** Every class token in the snippet, from quoted and unquoted class attributes. */
export function classTokens(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(CLASS_ATTR_RE)) {
    for (const token of (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/)) if (token) out.push(token);
  }
  return out;
}

/** Emirates ID: full-format value (all digits — an unmasked real ID shape). */
const FULL_EID_RE = /\b784-\d{4}-\d{7}-\d\b/;
export const EID_PATTERN = "^784-\\d{4}-\\d{7}-\\d$";
/** Signals an <input> is an Emirates ID field — from its own attributes or its <label>. */
const EID_SIGNAL_RE = /784|emirates[-_ ]?id|\beid\b|الهوية الإماراتية/i;
/**
 * Unambiguously MDY-ordered date: first component a valid month (1-12), second
 * 13-31 — impossible as a month, so the date is provably month-first. Ambiguous
 * dates (both components <= 12) cannot be judged and are not flagged.
 * DMY dates are a non-negotiable for UAE government content.
 */
const MDY_DATE_RE = /\b(0?[1-9]|1[0-2])\/(1[3-9]|2\d|3[01])\/((?:19|20)\d{2})\b/g;

/**
 * The catalogue-derived truth the class checks run against. Build it once per
 * catalogue load; it is immutable after that.
 */
export type ClassIndex = {
  /** Package truth: every class that ships in the pinned version. */
  packageClasses: Set<string>;
  /** aegov-* classes the docs use that do NOT ship (class -> explanation). */
  docsOnly: Record<string, string>;
  /** Every non-aegov class used by official docs examples. */
  docsExampleClasses: Set<string>;
  /** "@aegov/design-system@3.0.7" — for finding messages and reports. */
  packageRef: string;
};

export function buildClassIndex(catalog: Catalog): ClassIndex {
  const packageClasses = new Set(
    catalog.components.flatMap((c) => c.classes.map((cls) => cls.replace(/^\./, ""))),
  );

  // Docs evidence: every non-aegov class used by official docs examples
  // (modifiers like btn-outline, structural hooks like form-control-input,
  // and the Tailwind utilities the docs themselves use).
  const docsExampleClasses = new Set<string>();
  const allExamples = [
    ...catalog.components.flatMap((c) => [c.markup, ...c.examples]),
    ...[...catalog.blocks, ...catalog.patterns, ...catalog.docsOnlyComponents].flatMap((a) => [
      a.markup,
      ...a.examples,
    ]),
  ];
  for (const ex of allExamples) {
    if (ex) for (const t of classTokens(ex.html)) docsExampleClasses.add(t);
  }

  return {
    packageClasses,
    docsOnly: catalog.meta.knownDocsOnlyClasses,
    docsExampleClasses,
    packageRef: `${catalog.meta.generatedFrom.package}@${catalog.meta.generatedFrom.version}`,
  };
}

/** Class identity (package tier — certain) + docs-example evidence (best-effort). */
export function checkClassIdentity(
  html: string,
  index: ClassIndex,
): { findings: Finding[]; classes: ClassBuckets } {
  const findings: Finding[] = [];
  const seen: ClassBuckets = {
    packageVerified: [],
    seenInDocsExamples: [],
    unverified: [],
  };

  for (const token of new Set(classTokens(html))) {
    if (index.packageClasses.has(token)) {
      seen.packageVerified.push(token);
    } else if (token.startsWith("aegov-")) {
      if (token in index.docsOnly) {
        findings.push({
          level: "error",
          confidence: "package",
          message:
            `Class '${token}' appears in the official docs but does NOT ship in ` +
            `${index.packageRef}: ${index.docsOnly[token]}`,
        });
      } else {
        const near = [...index.packageClasses].filter(
          (c) => c.includes(token.replace(/^aegov-/, "")) || token.includes(c.replace(/^aegov-/, "")),
        );
        findings.push({
          level: "error",
          confidence: "package",
          message:
            `Unknown class '${token}' — not in ${index.packageRef}. ` +
            `Use official component classes only.` +
            (near.length ? ` Did you mean: ${near.slice(0, 5).join(", ")}?` : ""),
        });
      }
    } else if (index.docsExampleClasses.has(token)) {
      seen.seenInDocsExamples.push(token);
    } else {
      seen.unverified.push(token);
    }
  }
  if (seen.unverified.length) {
    findings.push({
      level: "info",
      confidence: "docs",
      message:
        `Classes not seen in any official docs example (cannot verify — may be valid ` +
        `Tailwind/DLS token utilities): ${seen.unverified.sort().join(", ")}`,
    });
  }
  return { findings, classes: seen };
}

// NB: HTML attribute names are case-insensitive and values may be
// unquoted — every attribute regex below must carry the `i` flag and the
// unquoted alternative ([^\s"'=<>`]+), or valid markup gets flagged.

/** <img> without alt (WCAG 2.2 AA 1.1.1). */
export function checkImgAlt(html: string): Finding[] {
  const findings: Finding[] = [];
  for (const img of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=/i.test(img[0]))
      findings.push({
        level: "error",
        confidence: "heuristic",
        message: `<img> without alt attribute (WCAG 2.2 AA 1.1.1): ${img[0].slice(0, 80)}`,
      });
  }
  return findings;
}

/** <button> without an explicit type (defaults to submit inside forms). */
export function checkButtonType(html: string): Finding[] {
  const findings: Finding[] = [];
  for (const btn of html.matchAll(/<button\b[^>]*>/gi)) {
    if (!/\btype\s*=/i.test(btn[0]))
      findings.push({
        level: "warning",
        confidence: "heuristic",
        message: `<button> without explicit type (defaults to submit inside forms): ${btn[0].slice(0, 80)}`,
      });
  }
  return findings;
}

/** A displayed full-format Emirates ID value (must be masked). */
export function checkFullEidValue(html: string): Finding[] {
  if (FULL_EID_RE.test(html.replace(/pattern\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, ""))) {
    return [
      {
        level: "error",
        confidence: "heuristic",
        message:
          "Snippet contains a full-format Emirates ID value (784-NNNN-NNNNNNN-N). Displayed " +
          "Emirates IDs must be masked (784-1945-XXXXXXX-X) with an explicit reveal control.",
      },
    ];
  }
  return [];
}

/** Emirates ID inputs must carry the exact validation pattern. */
export function checkEmiratesIdInputs(html: string): Finding[] {
  const findings: Finding[] = [];
  // Map <label for="X"> → its visible text, so an EID field identified only
  // by its label (input carrying a generic name/id) is still recognised.
  const labelFor = new Map<string, string>();
  for (const lbl of html.matchAll(
    /<label\b[^>]*\bfor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>([\s\S]*?)<\/label>/gi,
  )) {
    const forId = lbl[1] ?? lbl[2] ?? lbl[3];
    if (forId) labelFor.set(forId, `${labelFor.get(forId) ?? ""} ${lbl[4]}`);
  }
  // Map id → immediate text content of any element, so aria-labelledby
  // references resolve to their visible text too.
  const idText = new Map<string, string>();
  for (const el of html.matchAll(
    /<[a-z][^>]*\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>([^<]*)/gi,
  )) {
    const id = el[1] ?? el[2] ?? el[3];
    if (id) idText.set(id, `${idText.get(id) ?? ""} ${el[4]}`);
  }
  for (const input of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = input[0];
    // A field's identity comes from its name/id/placeholder/aria AND its
    // associated <label> / aria-labelledby text — never the entered value
    // (value is stripped: a search box whose value mentions "Emirates ID"
    // is still a search box). The input's own attributes are decisive; the
    // label text is only a secondary signal, gated by looksSearch so a
    // search box labelled "…Emirates ID…" isn't mistaken for an ID field.
    const identity = tag.replace(/\bvalue\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, "");
    const idAttr = tag.match(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    const ariaRef = tag.match(
      /\baria-labelledby\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i,
    );
    const labelText = [
      idAttr ? (labelFor.get(idAttr[1] ?? idAttr[2] ?? idAttr[3] ?? "") ?? "") : "",
      ...(ariaRef
        ? (ariaRef[1] ?? ariaRef[2] ?? ariaRef[3] ?? "")
            .split(/\s+/)
            .map((ref) => idText.get(ref) ?? "")
        : []),
    ].join(" ");
    const looksSearch = /type\s*=\s*["']?search|role\s*=\s*["']?search|\bsearch\b/i.test(
      identity,
    );
    const looksEid =
      EID_SIGNAL_RE.test(identity) || (!looksSearch && EID_SIGNAL_RE.test(labelText));
    if (!looksEid) continue;
    const patternMatch = tag.match(/\bpattern\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    const pattern = patternMatch
      ? (patternMatch[1] ?? patternMatch[2] ?? patternMatch[3])
      : undefined;
    if (!pattern) {
      findings.push({
        level: "error",
        confidence: "heuristic",
        message:
          `Emirates ID input without pattern validation — must validate ${EID_PATTERN}: ` +
          tag.slice(0, 100),
      });
    } else if (pattern !== EID_PATTERN) {
      findings.push({
        level: "error",
        confidence: "heuristic",
        message:
          `Emirates ID input pattern '${pattern}' differs from the required ${EID_PATTERN}.`,
      });
    }
  }
  return findings;
}

/** Unambiguously month-first dates (UAE government content is DMY). */
export function checkMdyDates(html: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of html.matchAll(MDY_DATE_RE)) {
    findings.push({
      level: "error",
      confidence: "heuristic",
      message:
        `Date '${m[0]}' is month-first (MDY) — UAE government content uses DMY dates: ` +
        `write it as ${m[2]}/${m[1].padStart(2, "0")}/${m[3]}.`,
    });
  }
  return findings;
}

/** Arabic text without an RTL direction. */
export function checkArabicRtl(html: string): Finding[] {
  const hasArabic = /[؀-ۿ]/.test(html);
  if (hasArabic && !/\bdir\s*=\s*["']?rtl/i.test(html)) {
    return [
      {
        level: "warning",
        confidence: "heuristic",
        message:
          "Snippet contains Arabic text but no dir=\"rtl\" — acceptable only if an ancestor " +
          "element already establishes RTL direction.",
      },
    ];
  }
  return [];
}

/**
 * Run every DLS check over an HTML string, in the order Stage 1's
 * validate_snippet established (class identity first, then heuristics).
 */
export function validateHtml(
  html: string,
  index: ClassIndex,
): { findings: Finding[]; classes: ClassBuckets } {
  const { findings, classes } = checkClassIdentity(html, index);
  findings.push(
    ...checkImgAlt(html),
    ...checkButtonType(html),
    ...checkFullEidValue(html),
    ...checkEmiratesIdInputs(html),
    ...checkMdyDates(html),
    ...checkArabicRtl(html),
  );
  return { findings, classes };
}
