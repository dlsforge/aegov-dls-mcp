/**
 * Arabic / RTL parity (STAGE2-HANDOFF §6 step 4, non-negotiable §7): both
 * language versions present and structurally equivalent.
 *
 * FLAG, DON'T ASSERT (§2/§9 locked): every finding here is a review flag for
 * a human — a native speaker confirms content parity; Mizan never asserts
 * Arabic parity as settled fact.
 *
 * The alternate URL comes from --parity <url>, or is discovered from
 * <link rel="alternate" hreflang="ar|en"> on the audited page.
 */
import type { Page, Browser } from "playwright";
import type { AuditFinding } from "../report/types.js";
import { settleNavigation } from "./settle.js";

type StructureProfile = {
  lang: string;
  dir: string;
  headings: number;
  links: number;
  forms: number;
  inputs: number;
  buttons: number;
  images: number;
  landmarks: number;
  aegovRoots: string[];
};

async function profileOf(page: Page): Promise<StructureProfile> {
  return (await page.evaluate(() => {
    const roots = new Set<string>();
    for (const el of document.querySelectorAll('[class*="aegov-"]')) {
      for (const c of Array.from(el.classList)) {
        const m = c.match(/^aegov-[a-z0-9]+(?:-[a-z0-9]+)*/);
        if (m) roots.add(m[0]);
      }
    }
    return {
      lang: document.documentElement.lang || "",
      dir: document.documentElement.dir || "",
      headings: document.querySelectorAll("h1,h2,h3,h4,h5,h6").length,
      links: document.querySelectorAll("a[href]").length,
      forms: document.querySelectorAll("form").length,
      inputs: document.querySelectorAll("input,select,textarea").length,
      buttons: document.querySelectorAll("button").length,
      images: document.querySelectorAll("img").length,
      landmarks: document.querySelectorAll("main,nav,header,footer,aside").length,
      aegovRoots: Array.from(roots).sort(),
    };
  })) as StructureProfile;
}

export async function discoverAlternate(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const lang = (document.documentElement.lang || "").toLowerCase();
    const want = lang.startsWith("ar") ? "en" : "ar";
    const link = document.querySelector(
      `link[rel="alternate"][hreflang^="${want}"]`,
    ) as HTMLLinkElement | null;
    return link?.href ?? null;
  });
}

const REVIEW = "Parity is flagged for human review — a native speaker confirms; Mizan does not assert it.";

export async function runParityCheck(
  browser: Browser,
  page: Page,
  alternateUrl: string,
): Promise<AuditFinding[]> {
  const base = await profileOf(page);
  const altPage = await browser.newPage();
  let alt: StructureProfile;
  try {
    await altPage.goto(alternateUrl, { waitUntil: "load", timeout: 60_000 });
    if (/^https?:/i.test(alternateUrl)) await settleNavigation(altPage);
    alt = await profileOf(altPage);
  } finally {
    await altPage.close();
  }

  const findings: AuditFinding[] = [];
  const flag = (ruleId: string, message: string, targets: string[] = []) =>
    findings.push({
      engine: "dls",
      ruleId,
      severity: "moderate",
      confidence: "heuristic",
      message: `${message} ${REVIEW}`,
      fix: null,
      helpUrl: null,
      tags: ["aegov-dls", "arabic-rtl-parity"],
      targets,
      nodeCount: 1,
    });

  const arabic = [base, alt].find((p) => p.lang.toLowerCase().startsWith("ar"));
  if (arabic && arabic.dir.toLowerCase() !== "rtl") {
    flag(
      "dls-parity-rtl",
      `The Arabic variant (lang="${arabic.lang}") does not set dir="rtl" on <html> — RTL is first-class in the standard.`,
    );
  }
  if (!base.lang || !alt.lang) {
    flag(
      "dls-parity-lang",
      `A variant is missing the <html lang> attribute (base: "${base.lang}", alternate: "${alt.lang}") — bilingual structure requires explicit language tagging.`,
    );
  }

  const counted: Array<[string, number, number]> = [
    ["headings", base.headings, alt.headings],
    ["links", base.links, alt.links],
    ["forms", base.forms, alt.forms],
    ["inputs", base.inputs, alt.inputs],
    ["buttons", base.buttons, alt.buttons],
    ["images", base.images, alt.images],
    ["landmarks", base.landmarks, alt.landmarks],
  ];
  const drift = counted.filter(([, a, b]) => {
    const max = Math.max(a, b);
    return max > 0 && Math.abs(a - b) / max > 0.2 && Math.abs(a - b) >= 3;
  });
  if (drift.length) {
    flag(
      "dls-parity-structure",
      `Language variants differ structurally beyond tolerance: ` +
        drift.map(([k, a, b]) => `${k} ${a}↔${b}`).join(", ") +
        ` — the versions may not be equivalent.`,
    );
  }

  const missingRoots = [
    ...base.aegovRoots.filter((r) => !alt.aegovRoots.includes(r)).map((r) => `${r} (alternate)`),
    ...alt.aegovRoots.filter((r) => !base.aegovRoots.includes(r)).map((r) => `${r} (base)`),
  ];
  if (missingRoots.length) {
    flag(
      "dls-parity-components",
      `DLS components present in one language variant but missing in the other: ${missingRoots.slice(0, 8).join(", ")}${missingRoots.length > 8 ? "…" : ""}.`,
      missingRoots.slice(0, 8),
    );
  }
  return findings;
}
