/**
 * scaffoldUaePass — official-guideline UAE Pass login/action button markup.
 *
 * Two sources, both surfaced with provenance:
 *  - Markup vocabulary: AEGOV DLS (package tier) — aegov-btn plus DLS token
 *    utilities (aeblack / whitely scales). No arbitrary values.
 *  - Wording, appearance, sizing, logo and OAuth2 guidance: docs.uaepass.ae
 *    (docs tier, HIGH-STAKES — provisional, needs revalidation).
 *
 * The official UAE Pass logo artwork is downloadable (assets in the response);
 * it is never inlined or redrawn here — brand artwork must be the official file.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { UaePassGuidance, UaePassRule } from "@dlsforge/aegov-rules-core";
import { json } from "./shared.js";

export const UAEPASS_TRUST =
  "docs-sourced from docs.uaepass.ae — provisional and HIGH-STAKES: revalidate against the live developer docs before shipping";

const ARABIC_NOTE =
  "Arabic strings were GENERATED (the docs publish Arabic button titles only as images) — " +
  "they need native-speaker review before shipping. The official Arabic artwork ships in the " +
  "downloadable button assets; prefer it as the visual reference.";

/**
 * Generated Arabic labels (flagged for native review — see ARABIC_NOTE).
 * UAE PASS is rendered by its official Arabic name, الهوية الرقمية.
 */
const LABELS: Record<string, { en: string; ar: string }> = {
  "sign-in": { en: "Sign in with UAE PASS", ar: "تسجيل الدخول بالهوية الرقمية" },
  "sign-up": { en: "Sign up with UAE PASS", ar: "إنشاء حساب بالهوية الرقمية" },
  login: { en: "Login with UAE PASS", ar: "تسجيل الدخول بالهوية الرقمية" },
  continue: { en: "Continue with UAE PASS", ar: "المتابعة بالهوية الرقمية" },
  sign: { en: "Sign with UAE PASS", ar: "التوقيع بالهوية الرقمية" },
};

/**
 * Appearance → DLS token utilities. UAE Pass permits exactly white, white
 * outlined, and black buttons; title text black or white only; the logo may
 * only be the official black-with-accents or white-with-accents artwork.
 */
const APPEARANCES = {
  black: {
    classes: "bg-aeblack-950 text-whitely-50 hover:bg-aeblack-800",
    logo: "white logo with green and red accents",
  },
  white: {
    classes: "bg-whitely-50 text-aeblack-950 hover:bg-whitely-100",
    logo: "black logo with green and red accents",
  },
  outline: {
    classes:
      "bg-whitely-50 text-aeblack-950 border border-aeblack-950 hover:bg-whitely-100",
    logo: "black logo with green and red accents",
  },
} as const;

const RADII = { default: "", rectangle: "rounded-none", pill: "rounded-full" } as const;

/** Rules relevant to every scaffold, matched by docs-page path suffix. */
const ALWAYS_RULES = [
  "/button-options",
  "/button-radius",
  "/button-size-and-margin",
  "/button-states-and-feedback",
  "/dos-and-donts/logo-and-title-colors",
  "/dos-and-donts/using-logo-and-text",
  "/dos-and-donts/text-visibility-and-spacing",
];

const VARIANT_RULES: Record<string, string[]> = {
  "sign-in": ["/dos-and-donts/sign-in-and-sign-up", "/button-guidelines/sign-in-and-sign-up"],
  "sign-up": ["/dos-and-donts/sign-in-and-sign-up", "/button-guidelines/sign-in-and-sign-up"],
  login: ["/login-option", "/dos-and-donts/sign-in-and-sign-up"],
  continue: ["/continue-with-uae-pass"],
  sign: ["/sign-with-uae-pass"],
};

const APPEARANCE_RULES: Record<string, string> = {
  black: "/dos-and-donts/black-button",
  white: "/dos-and-donts/white-button",
  outline: "/dos-and-donts/outline-button",
};

function ruleView(r: UaePassRule) {
  return { kind: r.kind, topic: r.topic, statement: r.statement, source: r.provenance.sourceUrl };
}

function pickRules(guidance: UaePassGuidance, suffixes: string[]) {
  const wanted = (r: UaePassRule) =>
    suffixes.findIndex((s) => r.provenance.sourceUrl.endsWith(s));
  return guidance.rules
    .filter((r) => wanted(r) !== -1)
    .sort((a, b) => wanted(a) - wanted(b))
    .map(ruleView);
}

function buttonHtml(opts: {
  variant: string;
  appearance: keyof typeof APPEARANCES;
  radius: keyof typeof RADII;
  lang: "en" | "ar";
}) {
  const { variant, appearance, radius, lang } = opts;
  const label = LABELS[variant][lang];
  const cls = ["aegov-btn", APPEARANCES[appearance].classes, RADII[radius]]
    .filter(Boolean)
    .join(" ");
  const logo = APPEARANCES[appearance].logo;
  const langAttrs = lang === "ar" ? ' lang="ar" dir="rtl"' : "";
  const arReview = lang === "ar" ? "\n     ARABIC LABEL IS GENERATED — needs native-speaker review." : "";
  return `<!-- UAE PASS ${variant} button — AEGOV DLS markup, docs.uaepass.ae wording.
     {{UAEPASS_LOGIN_ROUTE}}: your server route that redirects to the UAE Pass
     authorize endpoint (generate the OAuth2 'state' per request, server-side —
     never hardcode it in markup).
     {{UAEPASS_LOGO}}: path to the OFFICIAL downloaded artwork (${logo});
     never recolor, redraw, stretch, or crop the logo.${arReview} -->
<a href="{{UAEPASS_LOGIN_ROUTE}}"${langAttrs} class="${cls}">
  <img src="{{UAEPASS_LOGO}}" alt="" aria-hidden="true" class="h-6 w-auto" />
  <span>${label}</span>
</a>`;
}

export function registerScaffoldUaePass(server: McpServer, guidance: UaePassGuidance): void {
  server.registerTool(
    "scaffoldUaePass",
    {
      title: "Scaffold a UAE Pass button",
      description:
        "Generate official-guideline UAE Pass button markup (UAE Pass is the mandatory national " +
        "digital identity — any government login must use it). Emits AEGOV DLS classes with the " +
        "documented wording, appearance and logo rules from docs.uaepass.ae, the OAuth2 authorize " +
        "URL template with staging/production endpoints, and links to the official logo assets. " +
        "Returns bilingual (English + Arabic) markup by default; Arabic strings are generated and " +
        "flagged for native review. Follow the returned rules and notes — they are the standard, " +
        "not suggestions.",
      inputSchema: {
        variant: z
          .enum(["sign-in", "sign-up", "login", "continue", "sign"])
          .default("sign-in")
          .describe(
            "Documented button wording: sign-in/sign-up (authentication; never both on one page), " +
              "login (synonym flow — don't mix with sign-in wording), continue (document sharing — " +
              "requires user disclosure), sign (digital signature)",
          ),
        appearance: z
          .enum(["black", "white", "outline"])
          .default("black")
          .describe(
            "Permitted appearances only. black: for white/light backgrounds; white: for dark or " +
              "colored backgrounds with sufficient contrast; outline: light backgrounds where the " +
              "white fill lacks contrast",
          ),
        language: z
          .enum(["en", "ar", "both"])
          .default("both")
          .describe("Markup language(s). 'both' returns English and Arabic (RTL) variants"),
        environment: z
          .enum(["staging", "production"])
          .default("staging")
          .describe("UAE Pass OAuth2 environment for the endpoint set"),
        radius: z
          .enum(["default", "rectangle", "pill"])
          .default("default")
          .describe(
            "Documented corner-radius options: default (standard, 12px), rectangle (minimum), " +
              "pill (maximum)",
          ),
      },
    },
    async ({ variant, appearance, language, environment, radius }) => {
      const html: Record<string, string> = {};
      if (language !== "ar") html.en = buttonHtml({ variant, appearance, radius, lang: "en" });
      if (language !== "en") html.ar = buttonHtml({ variant, appearance, radius, lang: "ar" });

      const endpoints = guidance.endpoints[environment];
      const authorizeUrlTemplate =
        `${endpoints.authorization}?response_type=code&client_id={{CLIENT_ID}}` +
        `&scope=urn:uae:digitalid:profile:general&state={{RANDOM_STATE}}` +
        `&redirect_uri={{REDIRECT_URI}}` +
        `&acr_values=urn:safelayer:tws:policies:authentication:level:low` +
        `&ui_locales={{en|ar}}`;

      const rules = pickRules(guidance, [
        ...(VARIANT_RULES[variant] ?? []),
        APPEARANCE_RULES[appearance],
        ...ALWAYS_RULES,
        ...(language !== "en" ? ["/button-titles-arabic"] : []),
      ]);

      return json({
        kind: "uae-pass-scaffold",
        scaffold: { variant, appearance, language, environment, radius },
        html,
        ...(language !== "en" ? { arabicNote: ARABIC_NOTE } : {}),
        minSize: {
          minWidth: guidance.minSize.minWidth,
          minHeight: guidance.minSize.minHeight,
          minMargin: guidance.minSize.minMargin,
          preserveAspectRatio: guidance.minSize.preserveAspectRatio,
          source: guidance.minSize.provenance.sourceUrl,
        },
        oauth: {
          environment,
          endpoints,
          authorizeUrlTemplate,
          note:
            "Redirect to the authorize URL from your server. 'state' must be generated per " +
            "request (CSRF safeguard, per the documented parameters); client_id and scope are " +
            "issued by the UAE PASS team. ui_locales renders the UAE Pass login page in en or ar.",
          params: guidance.authorize.params,
          source: guidance.authorize.provenance.sourceUrl,
        },
        officialAssets: {
          note:
            "Download the official button/logo artwork — do not redraw or recolor it. " +
            `This scaffold's ${appearance} button takes the ${APPEARANCES[appearance].logo}.`,
          files: guidance.assets.map((a) => ({ label: a.label, url: a.url })),
        },
        rules,
        provenance: {
          markup: "AEGOV DLS package tier (@aegov/design-system) — aegov-btn + token utilities",
          guidance: {
            origin: guidance.meta.origin,
            retrievedOn: guidance.meta.retrievedOn,
            trust: UAEPASS_TRUST,
          },
        },
      });
    },
  );
}
