/**
 * scaffoldEmiratesId — Emirates ID input + masked display, per the agreed
 * behaviour in STAGE1-HANDOFF.md §10.6 and the docs-sourced pattern record:
 *
 *  - aegov-form-control input (DLS package-tier markup)
 *  - user types 15 raw digits — never required to type spaces or dashes;
 *    the value auto-formats to the printed-card format 784-XXXX-XXXXXXX-X
 *  - validated against ^784-\d{4}-\d{7}-\d$ (format non-negotiable, §7)
 *  - bilingual labels (Arabic generated, flagged for native review)
 *  - masked display (784-1945-XXXXXXX-X convention) with an explicit reveal
 *
 * High-stakes: Emirates ID handling must be revalidated against the live
 * designsystem.gov.ae pattern page (docs tier).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Catalog } from "../catalog/types.js";
import { DOCS_TRUST, json } from "./shared.js";

export const EMIRATES_ID_PATTERN = "^784-\\d{4}-\\d{7}-\\d$";

const ARABIC_NOTE =
  "Arabic strings were GENERATED — they need native-speaker review before shipping.";

// Generated Arabic strings (flagged for native review — see ARABIC_NOTE).
const STRINGS = {
  label: { en: "Emirates ID number", ar: "رقم الهوية الإماراتية" },
  hint: {
    en: "Enter the 15 digits of your Emirates ID — dashes are added automatically.",
    ar: "أدخل الأرقام الخمسة عشر لهويتك الإماراتية — تُضاف الشرطات تلقائيًا.",
  },
  error: {
    en: "Enter a valid Emirates ID in the format 784-XXXX-XXXXXXX-X.",
    ar: "أدخل رقم هوية إماراتية صحيحًا بالصيغة 784-XXXX-XXXXXXX-X.",
  },
  reveal: { en: "Show full Emirates ID", ar: "إظهار رقم الهوية كاملًا" },
  hide: { en: "Hide Emirates ID", ar: "إخفاء رقم الهوية" },
};

function bilingual(lang: "en" | "ar" | "both", s: { en: string; ar: string }) {
  if (lang === "en") return s.en;
  if (lang === "ar") return s.ar;
  return `${s.en} <span lang="ar" dir="rtl">${s.ar}</span>`;
}

function inputHtml(lang: "en" | "ar" | "both", id: string) {
  const langAttrs = lang === "ar" ? ' lang="ar" dir="rtl"' : "";
  const arReview =
    lang !== "en" ? "\n     ARABIC STRINGS ARE GENERATED — need native-speaker review." : "";
  return `<!-- Emirates ID input — AEGOV DLS form control.
     The value is always LTR (it is a number), even in RTL layouts, hence
     dir="ltr" on the input. Pair with the auto-format script (js) so users
     type 15 raw digits and never need spaces or dashes.${arReview} -->
<div class="aegov-form-control"${langAttrs}>
  <label for="${id}">${bilingual(lang, STRINGS.label)}</label>
  <div class="form-control-input">
    <input
      type="text"
      id="${id}"
      name="${id}"
      dir="ltr"
      inputmode="numeric"
      autocomplete="off"
      placeholder="784-XXXX-XXXXXXX-X"
      pattern="${EMIRATES_ID_PATTERN}"
      maxlength="18"
      aria-describedby="${id}-hint"
      required
    />
  </div>
  <p id="${id}-hint" class="text-aeblack-500">${bilingual(lang, STRINGS.hint)}</p>
</div>`;
}

function formatScript(id: string) {
  return `// Emirates ID auto-format: accepts 15 raw digits, renders 784-XXXX-XXXXXXX-X.
// Users are never required to type spaces or dashes.
(function () {
  var input = document.getElementById(${JSON.stringify(id)});
  input.addEventListener("input", function () {
    var digits = input.value.replace(/\\D/g, "").slice(0, 15);
    var parts = [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 14), digits.slice(14, 15)];
    input.value = parts.filter(Boolean).join("-");
  });
})();`;
}

function maskedDisplayHtml(lang: "en" | "ar" | "both", id: string) {
  const arReview =
    lang !== "en" ? "\n     ARABIC STRINGS ARE GENERATED — need native-speaker review." : "";
  return `<!-- Masked Emirates ID display (784-1945-XXXXXXX-X convention) with an
     explicit reveal control. Render BOTH values server-side; never send the
     full ID to the page if the user has no need to reveal it.${arReview} -->
<span class="inline-flex items-center gap-2">
  <span id="${id}-display" dir="ltr" data-masked="{{MASKED_VALUE e.g. 784-1945-XXXXXXX-X}}"
        data-full="{{FULL_VALUE — omit this attribute to disable reveal}}">{{MASKED_VALUE}}</span>
  <button type="button" id="${id}-reveal" class="aegov-btn btn-link btn-sm"
          aria-controls="${id}-display" aria-pressed="false">${bilingual(lang, STRINGS.reveal)}</button>
</span>`;
}

function maskedDisplayScript(lang: "en" | "ar" | "both", id: string) {
  const reveal = lang === "ar" ? STRINGS.reveal.ar : STRINGS.reveal.en;
  const hide = lang === "ar" ? STRINGS.hide.ar : STRINGS.hide.en;
  return `// Explicit reveal/hide toggle for the masked Emirates ID.
(function () {
  var display = document.getElementById(${JSON.stringify(id + "-display")});
  var button = document.getElementById(${JSON.stringify(id + "-reveal")});
  if (!display.dataset.full) { button.hidden = true; return; }
  button.addEventListener("click", function () {
    var revealed = button.getAttribute("aria-pressed") === "true";
    display.textContent = revealed ? display.dataset.masked : display.dataset.full;
    button.setAttribute("aria-pressed", String(!revealed));
    button.textContent = revealed ? ${JSON.stringify(reveal)} : ${JSON.stringify(hide)};
  });
})();`;
}

export function registerScaffoldEmiratesId(server: McpServer, catalog: Catalog): void {
  const pattern = catalog.patterns.find((p) => p.id === "emirates-id-input");

  server.registerTool(
    "scaffoldEmiratesId",
    {
      title: "Scaffold an Emirates ID input",
      description:
        "Generate the standard Emirates ID form control (AEGOV DLS aegov-form-control): accepts " +
        "15 raw digits, auto-formats to the printed-card format 784-XXXX-XXXXXXX-X, validates " +
        "the mandatory pattern ^784-\\d{4}-\\d{7}-\\d$, bilingual labels, plus a masked display " +
        "(784-1945-XXXXXXX-X) with an explicit reveal control. Emirates ID format, masking and " +
        "pattern validation are non-negotiable for UAE government services — use this scaffold " +
        "rather than hand-rolling. Returns html, the auto-format script, the masked-display " +
        "snippet, and the official pattern rules.",
      inputSchema: {
        language: z
          .enum(["en", "ar", "both"])
          .default("both")
          .describe("Label/hint language(s). 'both' emits bilingual labels (English + Arabic)"),
        id: z
          .string()
          .regex(/^[A-Za-z][\w-]*$/, "must be a valid HTML id")
          .default("emirates-id")
          .describe("HTML id/name for the input (also prefixes the hint and display ids)"),
        maskedDisplay: z
          .boolean()
          .default(true)
          .describe("Include the masked read-back display + reveal control snippet"),
      },
    },
    async ({ language, id, maskedDisplay }) => {
      return json({
        kind: "emirates-id-scaffold",
        scaffold: { language, id, maskedDisplay },
        html: inputHtml(language, id),
        js: formatScript(id),
        ...(maskedDisplay
          ? {
              maskedDisplay: {
                html: maskedDisplayHtml(language, id),
                js: maskedDisplayScript(language, id),
              },
            }
          : {}),
        format: {
          storage: "15 digits",
          display: "784-XXXX-XXXXXXX-X (as printed on the card)",
          masked: "784-1945-XXXXXXX-X — mask by default, reveal only on explicit user action",
          validationPattern: EMIRATES_ID_PATTERN,
        },
        ...(language !== "en" ? { arabicNote: ARABIC_NOTE } : {}),
        rules: (pattern?.rules ?? []).map((r) => ({
          kind: r.kind,
          statement: r.statement,
          source: r.provenance.tier === "docs" ? r.provenance.sourceUrl : null,
        })),
        provenance: {
          markup: "AEGOV DLS package tier (@aegov/design-system) — aegov-form-control",
          guidance: pattern
            ? {
                sourceUrl: pattern.provenance.sourceUrl,
                retrievedOn: pattern.provenance.retrievedOn,
                trust: `${DOCS_TRUST}; Emirates ID handling is HIGH-STAKES — verify especially carefully`,
              }
            : null,
        },
      });
    },
  );
}
