/**
 * Block conformance — evaluating a rendered page against the docs blocks'
 * curated contracts (see BlockContract in ../catalog/types.ts).
 *
 * WHY THE SPLIT: unlike the string-level rules in engine.ts, these invariants are
 * containment questions ("how many top-level items does THIS navigation have")
 * that regex over serialized HTML answers badly — and a wrong assertion against a
 * government site is the one failure mode this project refuses. So rules-core
 * keeps ALL the judgment (which selectors, which limits, what counts as
 * not-applicable) and hands the consumer a flat list of selector queries to run
 * against whatever DOM it has. Mizan runs them in Playwright; any other consumer
 * with a DOM runs the same list. Neither re-derives a rule.
 *
 *   const spec  = blockProbeSpec(catalog.blockContracts);
 *   const probe = <run spec.present / spec.groups / spec.texts against the DOM>;
 *   const results = checkBlockContracts(catalog.blockContracts, probe);
 */
import type { BlockContract, BlockRequirement } from "../catalog/types.js";
import { classTokens, type Finding } from "./engine.js";

/** The selector queries a consumer must run to evaluate the contracts. */
export interface BlockProbeSpec {
  /** Selectors needing a document-wide match count. */
  present: string[];
  /** Group counts: for each element matching `groupSelector`, count `childSelector` within it. */
  groups: Array<{ groupSelector: string; childSelector: string }>;
  /** Selectors needing the concatenated textContent of all matches. */
  texts: string[];
}

/** What the consumer collected from the DOM. */
export interface BlockProbe {
  /** selector -> number of matching elements. */
  counts: Record<string, number>;
  /** `${groupSelector} >> ${childSelector}` -> one child-count per group element. */
  groupCounts: Record<string, number[]>;
  /** selector -> concatenated textContent. */
  texts: Record<string, string>;
  /**
   * Queries the consumer could not evaluate (a selector its engine rejected).
   * A requirement that depends on one is "not-applicable": an unaskable
   * question has no answer, and treating a missing count as zero would report a
   * violation the page may not have. Keys are selectors, and for group checks
   * the `groupKey()` string.
   */
  unavailable?: string[];
  /**
   * The year to judge a dynamic copyright against — the consumer's audit date,
   * never a clock read inside this library (callers pin it for reproducibility).
   */
  currentYear: number;
}

export type BlockRequirementStatus = "satisfied" | "violated" | "not-applicable";

export interface BlockResult {
  requirementId: string;
  blockId: string;
  status: BlockRequirementStatus;
  severity: BlockRequirement["severity"];
  /** Present only when status is "violated". */
  message?: string;
  fix?: string;
  /** The docs sentence or markup the requirement rests on. */
  evidence: BlockRequirement["evidence"];
  sourceUrl: string;
}

/** Stable key for a group query, used in BlockProbe.groupCounts. */
export function groupKey(groupSelector: string, childSelector: string): string {
  return `${groupSelector} >> ${childSelector}`;
}

/** The flat query list for a set of contracts (deduplicated, order-stable). */
export function blockProbeSpec(contracts: BlockContract[]): BlockProbeSpec {
  const present = new Set<string>();
  const texts = new Set<string>();
  const groups = new Map<string, { groupSelector: string; childSelector: string }>();

  for (const contract of contracts) {
    for (const req of contract.requirements) {
      if (req.gate) present.add(req.gate);
      switch (req.check.kind) {
        case "present":
          present.add(req.check.selector);
          break;
        case "count-max":
          groups.set(groupKey(req.check.groupSelector, req.check.childSelector), {
            groupSelector: req.check.groupSelector,
            childSelector: req.check.childSelector,
          });
          break;
        case "text-current-year":
          texts.add(req.check.selector);
          break;
      }
    }
  }
  return { present: [...present], groups: [...groups.values()], texts: [...texts] };
}

/** A 4-digit year in plausible copyright range — used to tell "no year" from "stale year". */
const YEAR_RE = /\b(19|20)\d{2}\b/g;

function evaluate(
  req: BlockRequirement,
  probe: BlockProbe,
  sourceUrl: string,
): BlockResult {
  const base = {
    requirementId: req.id,
    blockId: req.blockId,
    severity: req.severity,
    evidence: req.evidence,
    sourceUrl,
  };

  // Anything the consumer could not ask about is unanswerable, not failing.
  const unavailable = new Set(probe.unavailable ?? []);
  const queryOf = (c: BlockRequirement["check"]): string =>
    c.kind === "count-max" ? groupKey(c.groupSelector, c.childSelector) : c.selector;
  if ((req.gate && unavailable.has(req.gate)) || unavailable.has(queryOf(req.check))) {
    return { ...base, status: "not-applicable" };
  }

  // A gate that does not match means the block (or the anchor the requirement
  // needs) is not on this page: report not-applicable so the consumer can say
  // "not checked" rather than pass or fail something it never saw.
  if (req.gate && (probe.counts?.[req.gate] ?? 0) === 0) {
    return { ...base, status: "not-applicable" };
  }

  const violated = (message: string): BlockResult => ({
    ...base,
    status: "violated",
    message,
    fix: req.fix,
  });

  const check = req.check;
  switch (check.kind) {
    case "present": {
      const n = probe.counts?.[check.selector];
      // A selector the consumer never reported was never ASKED — unanswerable,
      // so not-applicable. Only an explicit 0 ("asked, matched nothing") is a
      // violation. Reading a missing key as 0 asserted a failure against a page
      // the consumer had not measured, which is precisely the wrong-assertion
      // failure this module refuses.
      if (n === undefined) return { ...base, status: "not-applicable" };
      return n > 0 ? { ...base, status: "satisfied" } : violated(req.statement);
    }
    case "count-max": {
      const counts = probe.groupCounts?.[groupKey(check.groupSelector, check.childSelector)];
      if (!counts || counts.length === 0) return { ...base, status: "not-applicable" };
      const over = counts.filter((c) => c > check.max);
      return over.length === 0
        ? { ...base, status: "satisfied" }
        : violated(
            `${req.statement} Found ${over.length === 1 ? "a navigation" : `${over.length} navigations`} with ${over.join(", ")} top-level items (limit ${check.max}).`,
          );
    }
    case "text-current-year": {
      const text = probe.texts?.[check.selector] ?? "";
      const years = text.match(YEAR_RE);
      // No year at all: the copyright line may be absent or rendered as an
      // image — not evidence of a stale year, so do not assert either way.
      if (!years) return { ...base, status: "not-applicable" };
      return years.includes(String(probe.currentYear))
        ? { ...base, status: "satisfied" }
        : violated(
            `${req.statement} The footer shows ${[...new Set(years)].join(", ")} but not ${probe.currentYear}.`,
          );
    }
  }
}

/** Evaluate every requirement of every contract against a collected probe. */
export function checkBlockContracts(
  contracts: BlockContract[],
  probe: BlockProbe,
): BlockResult[] {
  return contracts.flatMap((contract) =>
    contract.requirements.map((req) => evaluate(req, probe, contract.provenance.sourceUrl)),
  );
}

// --- snippet path (no DOM) ----------------------------------------------------
//
// validate_snippet is handed a fragment, not a page, so the DOM path above does
// not apply. What makes a fragment tractable is that it is normally the block
// ITSELF: a selector scoped to the block root collapses to "does this token
// appear anywhere in the snippet". See SnippetSignal for why that approximation
// is safe in one direction only — it can miss a defect, never invent one.

/** What a snippet check concluded about one block. */
export interface BlockSnippetResult {
  blockId: string;
  name: string;
  sourceUrl: string;
  findings: Finding[];
  /**
   * Requirements a fragment genuinely cannot answer (counting a navigation's
   * direct children, judging a copyright year), with the reason. Surfaced so
   * the caller can say what was NOT looked at instead of implying a pass.
   */
  notCheckable: Array<{ requirementId: string; statement: string; reason: string }>;
}

/** Does an attribute name appear on some element in the snippet? */
function hasAttribute(html: string, name: string): boolean {
  return new RegExp(`\\s${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?=[\\s=>/])`, "i").test(html);
}

/**
 * Check a snippet against the contracts of whichever blocks it contains.
 *
 * A contract applies only when its `rootClass` is present — an arbitrary
 * fragment is not judged against the header block just for existing. Returns
 * one result per block found; an empty array means the snippet is not
 * (claiming to be) a documented block at all.
 */
export function checkBlockSnippet(
  html: string,
  contracts: BlockContract[],
): BlockSnippetResult[] {
  const tokens = new Set(classTokens(html));
  const results: BlockSnippetResult[] = [];

  for (const contract of contracts) {
    if (!tokens.has(contract.rootClass)) continue;

    const findings: Finding[] = [];
    const notCheckable: BlockSnippetResult["notCheckable"] = [];

    for (const req of contract.requirements) {
      const signal = req.snippetSignal;
      // The root requirement is what made this contract apply; re-reporting it
      // would be noise.
      if (signal?.kind === "class" && signal.value === contract.rootClass) continue;

      if (!signal) {
        notCheckable.push({
          requirementId: req.id,
          statement: req.statement,
          reason:
            req.check.kind === "count-max"
              ? "needs the rendered element tree to count a list's direct children"
              : "needs the rendered page (and the audit date) to judge",
        });
        continue;
      }

      const satisfied =
        signal.kind === "class"
          ? tokens.has(signal.value)
          : signal.anyOf.some((a) => hasAttribute(html, a));
      if (satisfied) continue;

      findings.push({
        level: req.severity === "error" ? "error" : "warning",
        // Blocks live only in the docs, never in the npm package.
        confidence: "docs",
        message: `${contract.name} block: ${req.statement} ${req.fix} (${contract.provenance.sourceUrl})`,
      });
    }

    results.push({
      blockId: contract.blockId,
      name: contract.name,
      sourceUrl: contract.provenance.sourceUrl,
      findings,
      notCheckable,
    });
  }
  return results;
}

/**
 * Contracts whose source docs page has changed since a human last reviewed the
 * invariants. Non-empty means they must be re-read before their verdicts are
 * trusted (docs tier is provisional by construction).
 *
 * The primary guard is at build time — build-catalog refuses to emit a stale
 * catalogue at all — so on a catalogue this repo produced, this returns []. It
 * exists for consumers evaluating catalogue data they did not build themselves.
 */
export function staleBlockContracts(contracts: BlockContract[]): BlockContract[] {
  return contracts.filter((c) => c.sourceContentHash !== c.provenance.contentHash);
}
