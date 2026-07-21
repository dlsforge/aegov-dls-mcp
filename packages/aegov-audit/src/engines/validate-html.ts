/**
 * Stage 2C — checklist item 3.40 ("Are all pages and all HTML code W3C
 * compliant?") via html-validate (pinned, fully offline — STAGE2B-HANDOFF §4
 * forbids calls to validator.w3.org at audit time).
 *
 * Validation runs on the RAW SOURCE, not the rendered DOM: the browser
 * repairs markup while parsing, so a serialized DOM would hide exactly the
 * defects the item asks about. For http(s) targets the final URL is fetched
 * once more (self-identifying UA); for local files the file is read as-is.
 *
 * Preset choice: "html-validate:standard" — HTML5 spec conformance only
 * (close order, permitted content, duplicate IDs, attribute values). The
 * "recommended" preset adds style opinions (inline styles, a11y overlaps
 * with axe) that would fabricate findings the checklist question never asked
 * about. Fail-soft: if the source cannot be fetched, ran=false and the item
 * reads "not checked".
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { HtmlValidate } from "html-validate";
import type { AuditFinding } from "../report/types.js";
import { UA } from "./http.js";

const require = createRequire(import.meta.url);
const HV_VERSION = (require("html-validate/package.json") as { version: string }).version;

const hv = new HtmlValidate({ extends: ["html-validate:standard"] });

async function rawSource(finalUrl: string): Promise<string | null> {
  try {
    if (finalUrl.startsWith("file:")) return readFileSync(fileURLToPath(finalUrl), "utf8");
    if (!/^https?:/i.test(finalUrl)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(finalUrl, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,*/*" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.text()).slice(0, 2_000_000);
  } catch {
    return null;
  }
}

export async function runHtmlValidation(
  finalUrl: string,
): Promise<{ findings: AuditFinding[]; ran: boolean }> {
  const source = await rawSource(finalUrl);
  if (source === null) return { findings: [], ran: false };
  try {
    const report = await hv.validateString(source);
    if (report.valid) return { findings: [], ran: true };
    const messages = report.results.flatMap((r) => r.messages);
    const byRule = new Map<string, number>();
    for (const m of messages) byRule.set(m.ruleId, (byRule.get(m.ruleId) ?? 0) + 1);
    const samples = messages
      .slice(0, 10)
      .map((m) => `${m.line}:${m.column} [${m.ruleId}] ${m.message}`);
    return {
      ran: true,
      findings: [
        {
          engine: "dls",
          ruleId: "w3c-invalid-html",
          severity: "moderate",
          confidence: "external",
          message:
            `html-validate ${HV_VERSION} (offline, preset "standard" — HTML5 spec conformance only) ` +
            `reports ${report.errorCount} validation error(s) in the page source across ` +
            `${byRule.size} rule(s) (${[...byRule.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([id, n]) => `${id}×${n}`)
              .join(", ")}). E.g. ` +
            samples.slice(0, 3).join(" | "),
          fix: "Fix the listed markup errors at the source/template level; re-run to confirm zero errors.",
          helpUrl: null,
          tags: ["aegov-dls", "w3c", "tier-2c"],
          targets: samples,
          nodeCount: report.errorCount,
        },
      ],
    };
  } catch {
    return { findings: [], ran: false };
  }
}
