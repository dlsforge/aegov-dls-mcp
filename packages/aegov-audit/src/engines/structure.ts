/**
 * Structural correctness of DLS components in the rendered DOM
 * (STAGE2-HANDOFF §6 step 4) — completes Stage 1 known-limit T5: correct
 * aegov-* classes in WRONG nesting validated clean in validate_snippet.
 *
 * Each invariant below was read off the official docs examples in the
 * catalogue (source URL on every finding) — docs-tier confidence, since the
 * markup contract ships only in the docs, not the npm package. Curated and
 * conservative on purpose: the exit test forbids fabricated failures, so an
 * invariant is only listed here if the docs example is unambiguous.
 */
import type { Page } from "playwright";
import type { AuditFinding } from "../report/types.js";

type Violation = { rule: string; desc: string; problem: string };

const DOCS = "https://designsystem.gov.ae/docs/components";

export async function runStructureChecks(page: Page): Promise<AuditFinding[]> {
  const violations = (await page.evaluate(() => {
    const out: Array<{ rule: string; desc: string; problem: string }> = [];
    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : "") +
      Array.from(el.classList)
        .slice(0, 3)
        .map((c) => `.${c}`)
        .join("");

    // check-item: the docs checkbox/radio pattern is input + associated label
    // inside the .aegov-check-item wrapper.
    for (const el of document.querySelectorAll(".aegov-check-item")) {
      const input = el.querySelector("input");
      const label = el.querySelector("label");
      if (!input || !label) {
        out.push({
          rule: "check-item",
          desc: describe(el),
          problem: `missing ${!input ? "<input>" : "<label>"} inside the check-item wrapper`,
        });
      } else if (input.id && label.getAttribute("for") !== input.id) {
        out.push({
          rule: "check-item",
          desc: describe(el),
          problem: `label for="${label.getAttribute("for") ?? ""}" does not reference the input id="${input.id}"`,
        });
      }
    }

    // modal: docs markup carries role="dialog", an accessible name, and the
    // .aegov-modal-wrapper content container.
    for (const el of document.querySelectorAll(".aegov-modal")) {
      const problems: string[] = [];
      if (el.getAttribute("role") !== "dialog" && !el.querySelector('[role="dialog"]'))
        problems.push('no role="dialog"');
      if (!el.hasAttribute("aria-labelledby") && !el.hasAttribute("aria-label"))
        problems.push("no aria-labelledby/aria-label (accessible name)");
      if (!el.querySelector(".aegov-modal-wrapper"))
        problems.push("no .aegov-modal-wrapper content container");
      if (problems.length)
        out.push({ rule: "modal", desc: describe(el), problem: problems.join("; ") });
    }

    // accordion: docs markup nests .accordion-item entries.
    for (const el of document.querySelectorAll(".aegov-accordion")) {
      if (!el.querySelector(".accordion-item")) {
        out.push({
          rule: "accordion",
          desc: describe(el),
          problem: "no .accordion-item children in the accordion",
        });
      }
    }
    return out;
  })) as Violation[];

  const docsUrl: Record<string, string> = {
    "check-item": `${DOCS}/checkbox`,
    modal: `${DOCS}/modal`,
    accordion: `${DOCS}/accordion`,
  };

  return violations.map((v) => ({
    engine: "dls" as const,
    ruleId: `dls-structure-${v.rule}`,
    severity: "moderate" as const,
    confidence: "docs" as const,
    message:
      `DLS component <${v.desc}> deviates from the official ${v.rule} structure: ${v.problem}. ` +
      `Structure contract is docs-sourced — confirm against the current docs before acting.`,
    fix: `Match the official markup at ${docsUrl[v.rule]}.`,
    helpUrl: docsUrl[v.rule],
    tags: ["aegov-dls", "structure", "T5"],
    targets: [v.desc],
    nodeCount: 1,
  }));
}
