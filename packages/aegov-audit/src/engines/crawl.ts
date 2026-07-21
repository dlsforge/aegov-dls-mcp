/**
 * Stage 2B Tier D — a small, polite, same-origin crawl (STAGE2B-HANDOFF §6
 * step 4): home + up to CRAWL_CAP linked pages, rendered in the same headless
 * browser. Answers the checklist items that are only meaningful across pages:
 *
 *  - 3.29 unique per-page titles / meta descriptions (duplicates flagged);
 *  - 3.35 upgraded from home-only to every crawled page (alternate hreflang);
 *  - 3.25 Page Rating block on service pages — PARTIAL: the page
 *    classification is an explicit heuristic (URL/title/heading wording);
 *    full classification is out of automated scope.
 *
 * Politeness (§9): http(s) only, same origin only, hard page cap, sequential
 * loads with a delay, a self-identifying User-Agent, and robots.txt
 * Disallow rules honoured (for our UA group, else *). Every network failure
 * is fail-soft: a page that will not load is skipped, never guessed about.
 */
import type { Browser, Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";
import { UA } from "./http.js";

export const CRAWL_CAP = 6;
const CRAWL_DELAY_MS = 300;
const PAGE_TIMEOUT_MS = 20_000;

const SKIP_EXTENSIONS =
  /\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|zip|rar|7z|docx?|xlsx?|pptx?|mp[34]|webm|css|js|json|xml|rss)$/i;

type PageScan = {
  url: string;
  title: string;
  description: string;
  hasAlternate: boolean;
  hasRatingBlock: boolean;
  looksLikeServicePage: boolean;
};

/** Disallow prefixes from robots.txt for our UA group (else the * group). */
export function parseRobots(body: string, uaToken: string): string[] {
  const groups: Array<{ agents: string[]; disallow: string[] }> = [];
  let current: { agents: string[]; disallow: string[] } | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, field, value] = m;
    if (/^user-agent$/i.test(field)) {
      if (!lastWasAgent || !current) {
        current = { agents: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && /^disallow$/i.test(field) && value) current.disallow.push(value);
    }
  }
  const ua = uaToken.toLowerCase();
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && ua.includes(a)));
  const star = groups.filter((g) => g.agents.includes("*"));
  return (own.length ? own : star).flatMap((g) => g.disallow);
}

function robotsAllows(disallow: string[], path: string): boolean {
  for (const rule of disallow) {
    // prefix match with * wildcards; $ anchors the end (common subset of the spec)
    const pattern =
      "^" +
      rule
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\\\$$/, "$");
    if (new RegExp(pattern).test(path)) return false;
  }
  return true;
}

async function scanPage(page: Page, url: string): Promise<PageScan> {
  return (await page.evaluate((u: string) => {
    const ratingByName =
      document.querySelector(
        '[id*="rating" i], [class*="rating" i], [id*="feedback" i], [class*="feedback" i]',
      ) !== null;
    const ratingByText =
      /was this (page|content) (helpful|useful)|rate this page|هل كانت هذه الصفحة مفيدة|قيّم هذه الصفحة/i.test(
        (document.body?.textContent ?? "").slice(0, 50_000),
      );
    const headings = Array.from(document.querySelectorAll("h1, h2"))
      .map((h) => h.textContent ?? "")
      .join(" ");
    return {
      url: u,
      title: (document.title ?? "").trim(),
      description: (
        document.querySelector('meta[name="description" i]')?.getAttribute("content") ?? ""
      ).trim(),
      hasAlternate: document.querySelector('link[rel="alternate"][hreflang]') !== null,
      hasRatingBlock: ratingByName || ratingByText,
      looksLikeServicePage: /service|خدم/i.test(location.pathname + " " + document.title + " " + headings),
    };
  }, url)) as PageScan;
}

export async function runCrawlChecks(
  browser: Browser,
  homePage: Page,
  finalUrl: string,
): Promise<{ findings: AuditFinding[]; pagesCrawled: number }> {
  if (!/^https?:/i.test(finalUrl)) return { findings: [], pagesCrawled: 0 };
  const origin = new URL(finalUrl).origin;

  // Candidate links from the rendered home page, nav/footer links first.
  const rawLinks = (await homePage
    .evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        href: (a as HTMLAnchorElement).href,
        inChrome: a.closest("nav, header, footer") !== null,
      })),
    )
    .catch(() => [])) as Array<{ href: string; inChrome: boolean }>;

  const normalize = (u: URL) => u.origin + u.pathname.replace(/\/+$/, "") + u.search;
  const home = normalize(new URL(finalUrl));
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const { href } of [...rawLinks.filter((l) => l.inChrome), ...rawLinks.filter((l) => !l.inChrome)]) {
    let u: URL;
    try {
      u = new URL(href);
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;
    if (SKIP_EXTENSIONS.test(u.pathname)) continue;
    if (/^(mailto|tel|javascript):/i.test(u.protocol)) continue;
    const n = normalize(u);
    if (n === home || seen.has(n)) continue;
    seen.add(n);
    candidates.push(u.origin + u.pathname + u.search);
  }

  let disallow: string[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": UA } });
    if (res.ok) disallow = parseRobots(await res.text(), "aegov-audit");
  } catch {
    /* no robots.txt reachable — nothing to honour */
  }

  const scans: PageScan[] = [];
  try {
    scans.push(await scanPage(homePage, finalUrl));
  } catch {
    /* home scan failed — subpage evidence still counts */
  }

  let pagesCrawled = 0;
  for (const url of candidates) {
    if (pagesCrawled >= CRAWL_CAP) break;
    if (!robotsAllows(disallow, new URL(url).pathname)) continue;
    await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
    let page: Page | null = null;
    try {
      page = await browser.newPage({ userAgent: UA });
      await page.goto(url, { waitUntil: "load", timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(600);
      scans.push(await scanPage(page, url));
      pagesCrawled++;
    } catch {
      /* fail soft — an unloadable page is skipped, not guessed about */
    } finally {
      await page?.close().catch(() => {});
    }
  }
  if (pagesCrawled === 0) return { findings: [], pagesCrawled: 0 };

  const findings: AuditFinding[] = [];
  const add = (
    ruleId: string,
    severity: AuditSeverity,
    message: string,
    fix: string | null,
    targets: string[],
    nodeCount = targets.length,
  ) =>
    findings.push({
      engine: "dls",
      ruleId,
      severity,
      confidence: "heuristic",
      message,
      fix,
      helpUrl: null,
      tags: ["aegov-dls", "crawl", "tier-d"],
      targets: targets.slice(0, 10),
      nodeCount,
    });

  const crawledNote = `across ${scans.length} crawled page(s) (home + ${pagesCrawled}, cap ${CRAWL_CAP})`;

  // 3.29 — duplicate titles / descriptions across the crawled set.
  const groupBy = (field: "title" | "description") => {
    const map = new Map<string, string[]>();
    for (const s of scans) {
      const v = s[field];
      if (!v) continue;
      map.set(v, [...(map.get(v) ?? []), s.url]);
    }
    return [...map.entries()].filter(([, urls]) => urls.length > 1);
  };
  for (const [title, urls] of groupBy("title"))
    add(
      "crawl-title-duplicate",
      "moderate",
      `${urls.length} pages share the identical <title> "${title.slice(0, 80)}" ${crawledNote} — ` +
        `the checklist asks for unique meta titles per page.`,
      "Give every page a unique, descriptive title (CMS templates should interpolate the page name).",
      urls,
    );
  for (const [desc, urls] of groupBy("description"))
    add(
      "crawl-description-duplicate",
      "minor",
      `${urls.length} pages share the identical meta description "${desc.slice(0, 80)}" ${crawledNote} — ` +
        `the checklist asks for unique descriptions per page.`,
      "Generate a per-page meta description from the page's own content.",
      urls,
    );

  // 3.35 — alternate hreflang on every crawled subpage (home is covered by
  // the single-page meta-alternate rule; do not double-report it).
  const missingAlternate = scans.filter((s) => s.url !== finalUrl && !s.hasAlternate);
  if (missingAlternate.length)
    add(
      "crawl-alternate-missing",
      "minor",
      `${missingAlternate.length} of ${pagesCrawled} crawled subpage(s) list no ` +
        `<link rel="alternate" hreflang="…"> — every page should point to its other-language version.`,
      "Emit alternate hreflang links on every page of both language versions.",
      missingAlternate.map((s) => s.url),
    );

  // 3.25 — Page Rating block on service pages (explicitly heuristic).
  const servicePagesWithoutRating = scans.filter((s) => s.looksLikeServicePage && !s.hasRatingBlock);
  if (servicePagesWithoutRating.length)
    add(
      "crawl-page-rating",
      "minor",
      `${servicePagesWithoutRating.length} crawled page(s) that look like service pages (heuristic ` +
        `classification by URL/title/heading wording — verify) carry no detectable Page Rating / ` +
        `feedback block: ` +
        servicePagesWithoutRating
          .slice(0, 5)
          .map((s) => s.url)
          .join(", ") +
        `. The checklist asks for the Page Rating block on all service card pages.`,
      "Add the DLS Page Rating block to service pages; full page classification needs human review.",
      servicePagesWithoutRating.map((s) => s.url),
    );

  return { findings, pagesCrawled };
}
