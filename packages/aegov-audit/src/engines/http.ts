/**
 * Stage 2B Tier B — origin-level HTTP checks: 3.64 sitemap.xml and 2.42/3.38
 * designed error pages. These need a network origin, so they run only for
 * http(s) targets (never file:// fixtures) — the checklist view marks the
 * items "not-checked" in that case rather than silently passing them.
 *
 * Fail-soft: a network error on a probe emits NOTHING (no evidence is not
 * evidence of absence). Probes identify themselves via User-Agent and are two
 * single GETs — no crawling here (that is Tier D, with its own politeness).
 */
import { createRequire } from "node:module";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

const require = createRequire(import.meta.url);
const own = require("../../package.json") as { version: string };

const UA = `aegov-audit/${own.version} (Mizan; +https://github.com/dlsforge/aegov-dls-mcp)`;
/** Fixed, deterministic probe path — improbable by construction, reproducible across runs. */
export const NOT_FOUND_PROBE_PATH = "/__mizan-404-probe__/this-page-must-not-exist";

async function get(url: string): Promise<{ status: number; body: string; contentType: string } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "*/*" },
    });
    clearTimeout(timer);
    const body = (await res.text()).slice(0, 100_000);
    return { status: res.status, body, contentType: res.headers.get("content-type") ?? "" };
  } catch {
    return null; // fail soft — no evidence, no finding
  }
}

function isXmlSitemap(body: string, contentType: string): boolean {
  return (
    /xml/i.test(contentType) || /^\s*<\?xml|<urlset|<sitemapindex/i.test(body.slice(0, 2000))
  );
}

/**
 * Default server error pages we can recognize as "not designed". The IIS
 * patterns match the real static-404 served by fnrc.gov.ae (found by a blind
 * cross-check review of the 2026-07-20 recorded run — the earlier signature
 * list missed IIS's actual wording).
 */
const BARE_ERROR_SIGNS =
  /<center>\s*nginx|<title>\s*404 Not Found\s*<\/title>|Apache\/[\d.]+ (Server )?at |<title>\s*IIS\b|This error page might contain sensitive information|404 - File or directory not found|<h1>Server Error<\/h1>|<title>\s*4\d\d - /i;

export async function runHttpChecks(finalUrl: string): Promise<AuditFinding[]> {
  if (!/^https?:/i.test(finalUrl)) return [];
  const origin = new URL(finalUrl).origin;

  const findings: AuditFinding[] = [];
  const add = (
    ruleId: string,
    severity: AuditSeverity,
    message: string,
    fix: string | null,
    target: string,
  ) =>
    findings.push({
      engine: "dls",
      ruleId,
      severity,
      confidence: "heuristic",
      message,
      fix,
      helpUrl: null,
      tags: ["aegov-dls", "http"],
      targets: [target],
      nodeCount: 1,
    });

  // 3.64 — sitemap.xml at the origin, or wherever robots.txt points.
  {
    let sitemapUrl = `${origin}/sitemap.xml`;
    const robots = await get(`${origin}/robots.txt`);
    const declared = robots?.status === 200 ? robots.body.match(/^\s*sitemap:\s*(\S+)/im) : null;
    if (declared) sitemapUrl = declared[1];
    const sitemap = await get(sitemapUrl);
    if (sitemap && (sitemap.status !== 200 || !isXmlSitemap(sitemap.body, sitemap.contentType)))
      add(
        "http-sitemap",
        "moderate",
        sitemap.status !== 200
          ? `No sitemap found: ${sitemapUrl} answers HTTP ${sitemap.status}` +
              (declared ? " (URL declared in robots.txt)" : " and robots.txt declares no Sitemap")
          : `${sitemapUrl} answers 200 but does not look like XML (content-type "${sitemap.contentType}").`,
        "Generate sitemap.xml from the CMS and declare it in robots.txt.",
        sitemapUrl,
      );
  }

  // 2.42 / 3.38 — a guaranteed-unknown URL should return a designed 404.
  {
    const probeUrl = origin + NOT_FOUND_PROBE_PATH;
    const probe = await get(probeUrl);
    if (probe) {
      if (probe.status === 200)
        add(
          "http-error-page",
          "moderate",
          `An unknown URL (${NOT_FOUND_PROBE_PATH}) answers HTTP 200 instead of 404 — a "soft 404". Search engines may index error pages, and users get no honest status.`,
          "Return real 404 status codes with the designed error page.",
          probeUrl,
        );
      else if (
        (probe.status === 404 || probe.status === 410) &&
        (probe.body.length < 512 || BARE_ERROR_SIGNS.test(probe.body))
      )
        add(
          "http-error-page",
          "moderate",
          `The 404 response for an unknown URL looks like a bare server default (${probe.body.length} bytes) — not the user-friendly designed error page the checklist asks for (404/403/500).`,
          "Serve the designed 404 page (site navigation, bilingual message, link home); do the same for 403/500.",
          probeUrl,
        );
      // Other statuses (403, 5xx, redirects to login…) are ambiguous — no guess.
    }
  }

  return findings;
}
