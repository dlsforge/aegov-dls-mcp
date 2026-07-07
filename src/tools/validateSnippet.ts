/**
 * validate_snippet — check an HTML snippet against the AEGOV DLS catalogue.
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
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Catalog } from "../catalog/types.js";
import { json } from "./shared.js";

const CLASS_ATTR_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

type Finding = {
  level: "error" | "warning" | "info";
  confidence: "package" | "docs" | "heuristic";
  message: string;
};

function classTokens(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(CLASS_ATTR_RE)) {
    for (const token of (m[1] ?? m[2]).split(/\s+/)) if (token) out.push(token);
  }
  return out;
}

/** Emirates ID: full-format value (all digits — an unmasked real ID shape). */
const FULL_EID_RE = /\b784-\d{4}-\d{7}-\d\b/;
const EID_PATTERN = "^784-\\d{4}-\\d{7}-\\d$";

export function registerValidateSnippet(server: McpServer, catalog: Catalog): void {
  // Package truth: every class that ships in the pinned version.
  const packageClasses = new Set(
    catalog.components.flatMap((c) => c.classes.map((cls) => cls.replace(/^\./, ""))),
  );
  const docsOnly = catalog.meta.knownDocsOnlyClasses;

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

  server.registerTool(
    "validate_snippet",
    {
      title: "Validate an HTML snippet against the UAE Design System",
      description:
        "Validate generated HTML against the AEGOV DLS: verifies every aegov-* class against the " +
        "pinned @aegov/design-system version (certain), checks other classes against official " +
        "docs-example usage (best-effort), and runs UAE-specific checks — Emirates ID inputs must " +
        "validate ^784-\\d{4}-\\d{7}-\\d$ and displayed IDs must be masked, images need alt, " +
        "Arabic content needs RTL handling. Call this on every snippet you emit before showing " +
        "it to the user; fix errors and re-validate.",
      inputSchema: {
        html: z.string().min(1).describe("The HTML snippet to validate"),
      },
    },
    async ({ html }) => {
      const findings: Finding[] = [];
      const seen = {
        packageClasses: [] as string[],
        docsExampleClasses: [] as string[],
        unverified: [] as string[],
      };

      // --- class identity (package tier — certain) ---------------------------
      for (const token of new Set(classTokens(html))) {
        if (packageClasses.has(token)) {
          seen.packageClasses.push(token);
        } else if (token.startsWith("aegov-")) {
          if (token in docsOnly) {
            findings.push({
              level: "error",
              confidence: "package",
              message:
                `Class '${token}' appears in the official docs but does NOT ship in ` +
                `${catalog.meta.generatedFrom.package}@${catalog.meta.generatedFrom.version}: ${docsOnly[token]}`,
            });
          } else {
            const near = [...packageClasses].filter(
              (c) => c.includes(token.replace(/^aegov-/, "")) || token.includes(c.replace(/^aegov-/, "")),
            );
            findings.push({
              level: "error",
              confidence: "package",
              message:
                `Unknown class '${token}' — not in ${catalog.meta.generatedFrom.package}@` +
                `${catalog.meta.generatedFrom.version}. Use official component classes only.` +
                (near.length ? ` Did you mean: ${near.slice(0, 5).join(", ")}?` : ""),
            });
          }
        } else if (docsExampleClasses.has(token)) {
          seen.docsExampleClasses.push(token);
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

      // --- heuristic structure / accessibility checks -------------------------
      for (const img of html.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\balt\s*=/.test(img[0]))
          findings.push({
            level: "error",
            confidence: "heuristic",
            message: `<img> without alt attribute (WCAG 2.2 AA 1.1.1): ${img[0].slice(0, 80)}`,
          });
      }
      for (const btn of html.matchAll(/<button\b[^>]*>/gi)) {
        if (!/\btype\s*=/.test(btn[0]))
          findings.push({
            level: "warning",
            confidence: "heuristic",
            message: `<button> without explicit type (defaults to submit inside forms): ${btn[0].slice(0, 80)}`,
          });
      }

      // --- UAE-specific checks (non-negotiables) -------------------------------
      if (FULL_EID_RE.test(html.replace(/pattern\s*=\s*"[^"]*"/g, ""))) {
        findings.push({
          level: "warning",
          confidence: "heuristic",
          message:
            "Snippet contains a full-format Emirates ID value (784-NNNN-NNNNNNN-N). Displayed " +
            "Emirates IDs should be masked (784-1945-XXXXXXX-X) with an explicit reveal control.",
        });
      }
      for (const input of html.matchAll(/<input\b[^>]*>/gi)) {
        const tag = input[0];
        const looksEid =
          /784/.test(tag) || /emirates[-_ ]?id/i.test(tag) || /\beid\b/i.test(tag);
        if (!looksEid) continue;
        const pattern = tag.match(/\bpattern\s*=\s*"([^"]*)"/)?.[1];
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
      const hasArabic = /[؀-ۿ]/.test(html);
      if (hasArabic && !/\bdir\s*=\s*["']?rtl/i.test(html)) {
        findings.push({
          level: "warning",
          confidence: "heuristic",
          message:
            "Snippet contains Arabic text but no dir=\"rtl\" — acceptable only if an ancestor " +
            "element already establishes RTL direction.",
        });
      }

      const errors = findings.filter((f) => f.level === "error").length;
      return json({
        valid: errors === 0,
        summary:
          `${errors} error(s), ${findings.filter((f) => f.level === "warning").length} warning(s); ` +
          `${seen.packageClasses.length} package-verified class(es).`,
        findings,
        classes: {
          packageVerified: seen.packageClasses.sort(),
          seenInDocsExamples: seen.docsExampleClasses.sort(),
          unverified: seen.unverified.sort(),
        },
        checkedAgainst: `${catalog.meta.generatedFrom.package}@${catalog.meta.generatedFrom.version}`,
        note:
          "Class identity is package-verified (certain). Structural and UAE-specific checks are " +
          "best-effort heuristics — passing them does not guarantee full standard compliance.",
      });
    },
  );
}
