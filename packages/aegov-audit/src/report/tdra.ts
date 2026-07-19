/**
 * TDRA checklist mirror (STAGE2-HANDOFF §6 step 5 / §8) — maps Mizan's
 * automated findings onto the official assessment-criteria items so the
 * report reads the way a TDRA reviewer reads.
 *
 * The checklist itself is the committed faithful extraction
 * (reference/tdra-assessment-criteria.json, v2.0 verified 2026-07-12).
 * The mapping below is CURATED and conservative: a finding is attached to an
 * item only when the evidence is direct. Most of the 125 items are process
 * questions only a human can answer — the report says so explicitly.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { AuditFinding } from "./types.js";

export type TdraCriteria = {
  meta: {
    title: string;
    version: string;
    published: string;
    provenance: Record<string, unknown>;
    pageStatedThresholds: {
      lighthouse: Record<string, string | string[]>;
      loadTime: Record<string, string>;
      provenance: Record<string, unknown>;
    };
    wcagBaseline: string;
  };
  sections: string[];
  items: Array<{
    id: string;
    section: string;
    category: string | null;
    subCategory: string | null;
    question: string;
  }>;
};

let cached: TdraCriteria | null = null;
export function loadTdraCriteria(): TdraCriteria {
  if (!cached) {
    const here = dirname(fileURLToPath(import.meta.url));
    cached = JSON.parse(
      readFileSync(join(here, "..", "..", "reference", "tdra-assessment-criteria.json"), "utf8"),
    ) as TdraCriteria;
  }
  return cached;
}

/** Mizan ruleId → TDRA checklist item ids (direct evidence only). */
const RULE_TO_ITEMS: Record<string, string[]> = {
  // DLS engines
  "dls-uaepass-missing": ["3.24"],
  "dls-class-identity": ["3.6"],
  "dls-not-used": ["3.6"],
  "dls-structure-check-item": ["3.6"],
  "dls-structure-modal": ["3.6"],
  "dls-structure-accordion": ["3.6"],
  "dls-button-type": ["3.6"],
  "dls-token-inline-style": ["3.2"],
  "dls-token-color": ["3.2"],
  "dls-img-alt": ["3.48"],
  "dls-img-alt-placeholder": ["3.48"],
  "dls-arabic-rtl": ["3.33"],
  "dls-parity-rtl": ["3.33"],
  "dls-parity-lang": ["3.34"],
  // document meta
  "meta-doctype": ["3.26"],
  "meta-charset": ["3.27"],
  "meta-viewport": ["3.28"],
  "meta-canonical": ["3.32"],
  "meta-dir": ["3.33"],
  "meta-lang": ["3.34"],
  "meta-lang-mismatch": ["3.34"],
  "meta-alternate": ["3.35"],
  // axe rules with a specific checklist home
  "heading-order": ["3.4"],
  "page-has-heading-one": ["3.4"],
  label: ["3.10"],
  "select-name": ["3.10"],
  "form-field-multiple-labels": ["3.10"],
  "image-alt": ["3.48"],
  "html-has-lang": ["3.34"],
  "html-lang-valid": ["3.34"],
  // Lighthouse-derived rules (Stage 2B Tier A) — evidence exists only when
  // --lighthouse ran; buildChecklistView marks these "not-checked" otherwise.
  "lh-render-blocking": ["3.43"],
  "lh-unminified-css": ["3.46"],
  "lh-unminified-javascript": ["3.46"],
  "lh-cache-policy": ["3.47"],
  "lh-page-weight-no-images": ["3.53"],
  "lh-page-weight-total": ["3.54"],
  "lh-third-party": ["3.58"],
  // Document/asset DOM rules (Stage 2B Tier B)
  "dom-skip-link": ["2.35"],
  "dom-icon-aria-hidden": ["3.8"],
  "dom-icon-no-text": ["3.9"],
  "dom-favicon": ["3.30"],
  "dom-theme-color": ["3.31"],
  "dom-og-tags": ["3.36"],
  "dom-semantic-tags": ["3.37"],
  "dom-noopener": ["3.39"],
  "dom-selfhosted-fonts": ["3.41"],
  "dom-blocking-script-head": ["3.57"],
  "dom-cookie-banner": ["3.59"],
  // Media DOM rules (Stage 2B Tier B)
  "dom-hero-no-picture": ["3.23"],
  "dom-no-srcset": ["3.49"],
  "dom-no-lazy-loading": ["3.50"],
  "dom-no-webp": ["3.51"],
  "dom-selfhosted-video": ["3.52"],
  // Origin HTTP probes (Stage 2B Tier B) — evidence exists only for http(s)
  // targets; buildChecklistView marks these "not-checked" for local files.
  "http-error-page": ["2.42", "3.38"],
  "http-sitemap": ["3.64"],
};

/**
 * Items whose ONLY evidence source carries the given rule-id prefix — these
 * flip to "not-checked" when that evidence engine did not run.
 */
function itemsOnlyEvidencedBy(prefix: string): Set<string> {
  const prefixed = new Set<string>();
  const other = new Set<string>();
  for (const [rule, items] of Object.entries(RULE_TO_ITEMS)) {
    for (const id of items) (rule.startsWith(prefix) ? prefixed : other).add(id);
  }
  other.add("3.12"); // axe WCAG gate
  return new Set([...prefixed].filter((id) => !other.has(id)));
}

/** Every WCAG-tagged axe finding also evidences item 3.12 (WCAG AA gate). */
function itemsForFinding(f: AuditFinding): string[] {
  const ids = new Set(RULE_TO_ITEMS[f.ruleId] ?? []);
  if (f.engine === "axe" && f.tags.some((t) => /^wcag2(1|2)?a{1,2}$/.test(t))) ids.add("3.12");
  return [...ids];
}

export type ChecklistItemView = {
  id: string;
  category: string | null;
  subCategory: string | null;
  question: string;
  /**
   * "not-checked" = the item's only evidence engine did not run this time
   * (today: Lighthouse-only items without --lighthouse). Never conflate with
   * "no-automated-findings", which means the engine ran and found nothing.
   */
  status: "findings" | "no-automated-findings" | "not-checked";
  findings: AuditFinding[];
};

export type ChecklistView = {
  source: {
    version: string;
    published: string;
    provenance: Record<string, unknown>;
    wcagBaseline: string;
  };
  machineCheckedItems: ChecklistItemView[];
  humanReviewCount: number;
  totalItems: number;
  note: string;
};

/** The item ids Mizan can currently speak to at all. */
export function machineCheckableIds(): Set<string> {
  const ids = new Set<string>(Object.values(RULE_TO_ITEMS).flat());
  ids.add("3.12");
  return ids;
}

export function buildChecklistView(
  findings: AuditFinding[],
  opts: { lighthouseRan?: boolean; httpRan?: boolean } = {},
): ChecklistView {
  const criteria = loadTdraCriteria();
  const byItem = new Map<string, AuditFinding[]>();
  for (const f of findings) {
    for (const id of itemsForFinding(f)) {
      byItem.set(id, [...(byItem.get(id) ?? []), f]);
    }
  }
  const checkable = machineCheckableIds();
  const notChecked = new Set<string>([
    ...(opts.lighthouseRan ? [] : itemsOnlyEvidencedBy("lh-")),
    ...(opts.httpRan ? [] : itemsOnlyEvidencedBy("http-")),
  ]);
  const machineCheckedItems: ChecklistItemView[] = criteria.items
    .filter((i) => checkable.has(i.id))
    .map((i) => ({
      id: i.id,
      category: i.category,
      subCategory: i.subCategory,
      question: i.question,
      status: byItem.has(i.id)
        ? ("findings" as const)
        : notChecked.has(i.id)
          ? ("not-checked" as const)
          : ("no-automated-findings" as const),
      findings: byItem.get(i.id) ?? [],
    }));
  return {
    source: {
      version: criteria.meta.version,
      published: criteria.meta.published,
      provenance: criteria.meta.provenance,
      wcagBaseline: criteria.meta.wcagBaseline,
    },
    machineCheckedItems,
    humanReviewCount: criteria.items.length - machineCheckedItems.length,
    totalItems: criteria.items.length,
    note:
      `Mizan machine-checks ${machineCheckedItems.length} of ${criteria.items.length} checklist ` +
      `items (fully or partially). "No automated findings" covers the machine-checkable subset ` +
      `only — it is NOT a pass; the remaining items are process/design questions a human answers. ` +
      `Items marked "not checked" had no evidence engine in this run (they need --lighthouse ` +
      `and/or an http(s) target for the origin probes).`,
  };
}
