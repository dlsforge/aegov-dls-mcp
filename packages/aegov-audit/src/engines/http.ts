/**
 * Stage 2B Tier B — origin-level HTTP checks: 3.64 Sitemap.xml, 1.5 the
 * human-facing site-map page, and 2.42/3.38 designed error pages. These need a
 * network origin, so they run only for http(s) targets (never file://
 * fixtures) — the checklist view marks the items "not-checked" in that case
 * rather than silently passing them.
 *
 * The two sitemap items are deliberately separate, because the checklist asks
 * two different questions and one artefact never answers both:
 *   3.64 "Does your CMS generate a Sitemap.xml file?" — the machine-readable
 *        Sitemaps-protocol file, for crawlers, served as XML.
 *   1.5  "Have you created the sitemap and information architecture?" — a
 *        human-facing page listing the site's sections.
 * A site with a fine /sitemap.aspx page and no XML file fails 3.64 and passes
 * 1.5; conflating them is what made the 3.64 finding read as "you have no
 * sitemap at all" (reported by a reviewer on 2026-08-10).
 *
 * Fail-soft: a network error on a probe emits NOTHING (no evidence is not
 * evidence of absence). Probes identify themselves via User-Agent and are a
 * small bounded number of single GETs — no crawling here (that is Tier D,
 * with its own politeness).
 */
import { createRequire } from "node:module";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

const require = createRequire(import.meta.url);
const own = require("../../package.json") as { version: string };

export const UA = `aegov-audit/${own.version} (Mizan; +https://github.com/dlsforge/aegov-dls-mcp)`;
/** Fixed, deterministic probe path — improbable by construction, reproducible across runs. */
export const NOT_FOUND_PROBE_PATH = "/__mizan-404-probe__/this-page-must-not-exist";

type Fetched = { status: number; body: string; contentType: string; finalUrl: string };

async function get(url: string): Promise<Fetched | null> {
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
    return {
      status: res.status,
      body,
      contentType: res.headers.get("content-type") ?? "",
      finalUrl: res.url || url,
    };
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

/** A link harvested from the audited page. Plain data — no Page type here. */
export type PageLink = { href: string; text: string; title: string };

/**
 * Well-known paths for a human-facing site-map page. Probed only as a fallback:
 * the page's own link is the authoritative signal, and the only way to find a
 * map at a path no list would guess (fnrc.gov.ae serves one at /portal/sitemap).
 */
export const SITEMAP_PAGE_PATHS = ["/sitemap", "/sitemap.aspx", "/sitemap.html", "/site-map"];

/** Link labels that name a site map, EN + AR. */
const SITEMAP_LABEL = /site\s*-?\s*map|sitemap|خريطة\s*الموقع/i;
/** A path that still reads as a site map after redirects. */
const SITEMAP_PATHISH = /sitemap|site-map|siteindex|خريطة/i;
/** Below this, the response is a stub or an error page dressed as one. */
const MIN_SITEMAP_PAGE_LINKS = 10;
/** Bounded politeness: never more GETs than this hunting for the page. */
export const MAX_SITEMAP_PAGE_PROBES = 5;

type SitemapCandidate = { url: string; labelled: boolean };

/** Malformed percent-encoding must not take the engine down — compare raw. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Candidate site-map-page URLs, best first: links the page itself labels as a
 * site map, then links whose path reads like one, then the well-known paths.
 * `labelled` records that the *source* asserted this is the site map, which
 * lets a map at an unguessable path qualify without its final path matching.
 */
export function sitemapPageCandidates(origin: string, links: PageLink[]): SitemapCandidate[] {
  const byLabel: SitemapCandidate[] = [];
  const byPath: SitemapCandidate[] = [];
  const seen = new Set<string>();
  const push = (into: SitemapCandidate[], url: string, labelled: boolean) => {
    if (seen.has(url)) return;
    seen.add(url);
    into.push({ url, labelled });
  };

  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l.href, origin);
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;
    if (/\.xml$/i.test(u.pathname)) continue; // that artefact answers 3.64
    const path = safeDecode(u.pathname);
    const labelled = SITEMAP_LABEL.test(`${l.text} ${l.title}`);
    if (labelled) push(byLabel, u.origin + u.pathname + u.search, true);
    else if (SITEMAP_PATHISH.test(path)) push(byPath, u.origin + u.pathname + u.search, false);
  }

  const wellKnown: SitemapCandidate[] = [];
  for (const p of SITEMAP_PAGE_PATHS) push(wellKnown, origin + p, false);

  return [...byLabel, ...byPath, ...wellKnown].slice(0, MAX_SITEMAP_PAGE_PROBES);
}

/**
 * Does this response actually look like a human-facing site-map page? Guards
 * against the two ways a naive 200-check lies: soft-404 sites that answer 200
 * for everything, and redirects into an error page.
 */
function qualifiesAsSitemapPage(r: Fetched, labelled: boolean): boolean {
  if (r.status !== 200) return false;
  if (!/html/i.test(r.contentType)) return false;
  if (isXmlSitemap(r.body, r.contentType)) return false; // XML answers 3.64, not 1.5
  if (BARE_ERROR_SIGNS.test(r.body)) return false;

  let finalPath: string;
  try {
    const u = new URL(r.finalUrl);
    finalPath = safeDecode(u.pathname + u.search);
  } catch {
    return false;
  }
  if (/error/i.test(finalPath)) return false; // redirected to an error page

  const anchors = (r.body.match(/<a\s[^>]*href\s*=/gi) ?? []).length;
  if (anchors < MIN_SITEMAP_PAGE_LINKS) return false;

  // An unlabelled candidate must still land somewhere site-map-shaped, or a
  // catch-all route that serves the home page would pass for a site map.
  return labelled || SITEMAP_PATHISH.test(finalPath);
}

export async function runHttpChecks(
  finalUrl: string,
  links: PageLink[] = [],
): Promise<AuditFinding[]> {
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

  // 3.64 — the CMS-generated Sitemap.xml, at the origin or wherever robots
  // points. Scoped tightly to the XML artefact: an HTML site-map page is a
  // different requirement (1.5, below) and must not read as satisfying this.
  {
    let sitemapUrl = `${origin}/sitemap.xml`;
    const robots = await get(`${origin}/robots.txt`);
    const declared = robots?.status === 200 ? robots.body.match(/^\s*sitemap:\s*(\S+)/im) : null;
    if (declared) sitemapUrl = declared[1];
    const sitemap = await get(sitemapUrl);
    const scope =
      ' Checklist 3.64 asks "Does your content management system generate a Sitemap.xml file?" —' +
      " the machine-readable Sitemaps-protocol file for search-engine crawlers." +
      " A human-facing site-map page does not satisfy it (that is item 1.5).";
    if (sitemap && (sitemap.status !== 200 || !isXmlSitemap(sitemap.body, sitemap.contentType)))
      add(
        "http-sitemap",
        "moderate",
        (sitemap.status !== 200
          ? `No XML sitemap: ${sitemapUrl} answers HTTP ${sitemap.status}` +
            (declared
              ? " (URL declared in robots.txt)"
              : " and robots.txt declares no Sitemap directive") +
            "."
          : `${sitemapUrl} answers 200 but is not XML (content-type "${sitemap.contentType}") — ` +
            "it does not parse as a Sitemaps-protocol document.") + scope,
        "Generate Sitemap.xml from the CMS, serve it as XML, and declare it in robots.txt.",
        sitemapUrl,
      );
  }

  // 1.5 — a human-facing site-map page. Evidence for "have you created the
  // sitemap and information architecture": a page listing the site's sections.
  // Only a real answer counts as absence; if every probe fails at the network
  // level we say nothing (see the fail-soft contract above).
  {
    const candidates = sitemapPageCandidates(origin, links);
    let found: string | null = null;
    let answered = false;
    for (const c of candidates) {
      const res = await get(c.url);
      if (!res) continue;
      answered = true;
      if (qualifiesAsSitemapPage(res, c.labelled)) {
        found = res.finalUrl;
        break;
      }
    }
    if (!found && answered)
      add(
        "http-sitemap-page",
        "moderate",
        "No human-facing site-map page found. Checklist 1.5 asks whether the sitemap and " +
          "information architecture were created; a page listing the site's sections is the " +
          `evidence. Probed ${candidates.length} candidate(s): ` +
          `${candidates.map((c) => new URL(c.url).pathname).join(", ")}. ` +
          "This is separate from item 3.64's Sitemap.xml.",
        "Publish a site-map page listing the site's sections and link it from the footer " +
          '("Site map" / "خريطة الموقع") so it is discoverable.',
        origin,
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
