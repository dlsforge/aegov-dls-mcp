/**
 * Stage 2B Tier B — media checks answering TDRA checklist items from the
 * rendered DOM: 3.23 hero <picture>/srcset, 3.49 responsive images,
 * 3.50 lazy loading, 3.51 WebP-first, 3.52 video delivery.
 *
 * Conservative: count-based rules fire only above small minimums (a page with
 * one decorative image should not be lectured about srcset), and the WebP
 * check is extension-based — CDNs that content-negotiate formats are called
 * out in the message instead of being false-positived silently.
 */
import type { Page } from "playwright";
import type { AuditFinding, AuditSeverity } from "../report/types.js";

type MediaScan = {
  imgTotal: number;
  imgWithSrcset: number;
  imgWithLazy: number;
  rasterCount: number;
  modernCount: number;
  unknownExtCount: number;
  heroExists: boolean;
  heroUsesPicture: boolean;
  selfHostedVideos: string[];
  embeddedPlayers: number;
};

export async function runMediaChecks(page: Page): Promise<AuditFinding[]> {
  const scan = (await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    const classify = (img: HTMLImageElement): "modern" | "raster" | "unknown" => {
      const sources = [
        img.currentSrc || img.getAttribute("src") || "",
        img.getAttribute("srcset") ?? "",
        ...Array.from(img.closest("picture")?.querySelectorAll("source") ?? []).map(
          (s) => (s.getAttribute("srcset") ?? "") + " " + (s.getAttribute("type") ?? ""),
        ),
      ]
        .join(" ")
        .toLowerCase();
      if (/\.(webp|avif)([?\s,]|$)|image\/(webp|avif)/.test(sources)) return "modern";
      if (/\.(jpe?g|png|gif|bmp)([?\s,]|$)/.test(sources)) return "raster";
      return "unknown";
    };
    let raster = 0,
      modern = 0,
      unknown = 0;
    for (const img of imgs) {
      const c = classify(img);
      if (c === "modern") modern++;
      else if (c === "raster") raster++;
      else unknown++;
    }

    const hero = document.querySelector('[class*="aegov-hero"]');
    const heroImg = hero?.querySelector("img") ?? null;
    const heroUsesPicture =
      heroImg !== null &&
      (heroImg.closest("picture") !== null || (heroImg.getAttribute("srcset") ?? "") !== "");

    const videos = Array.from(document.querySelectorAll("video"))
      .map(
        (v) =>
          v.getAttribute("src") ??
          v.querySelector("source")?.getAttribute("src") ??
          "",
      )
      .filter(Boolean);
    const players = Array.from(document.querySelectorAll("iframe[src]")).filter((f) =>
      /youtube(-nocookie)?\.com|youtu\.be|vimeo\.com/i.test(f.getAttribute("src") ?? ""),
    ).length;

    return {
      imgTotal: imgs.length,
      imgWithSrcset: imgs.filter(
        (i) => (i.getAttribute("srcset") ?? "") !== "" || i.closest("picture") !== null,
      ).length,
      imgWithLazy: imgs.filter((i) => (i.getAttribute("loading") ?? "").toLowerCase() === "lazy")
        .length,
      rasterCount: raster,
      modernCount: modern,
      unknownExtCount: unknown,
      heroExists: hero !== null && heroImg !== null,
      heroUsesPicture,
      selfHostedVideos: videos.slice(0, 10),
      embeddedPlayers: players,
    };
  })) as MediaScan;

  const findings: AuditFinding[] = [];
  const add = (
    ruleId: string,
    severity: AuditSeverity,
    message: string,
    fix: string | null = null,
    targets: string[] = ["img"],
    nodeCount = 1,
  ) =>
    findings.push({
      engine: "dls",
      ruleId,
      severity,
      confidence: "heuristic",
      message,
      fix,
      helpUrl: null,
      tags: ["aegov-dls", "media"],
      targets: targets.slice(0, 10),
      nodeCount,
    });

  if (scan.imgTotal >= 3 && scan.imgWithSrcset === 0)
    add(
      "dom-no-srcset",
      "moderate",
      `None of the ${scan.imgTotal} images use srcset or <picture> — no responsive image delivery as the design system describes.`,
      "Serve size-appropriate variants via srcset/sizes or <picture>.",
      ["img"],
      scan.imgTotal,
    );
  if (scan.heroExists && !scan.heroUsesPicture)
    add(
      "dom-hero-no-picture",
      "moderate",
      "The hero block's image does not use <picture>/srcset — the checklist asks for different hero images for mobile and desktop.",
      "Wrap the hero image in <picture> with mobile/desktop sources (srcset).",
      ['[class*="aegov-hero"] img'],
    );
  if (scan.imgTotal >= 5 && scan.imgWithLazy === 0)
    add(
      "dom-no-lazy-loading",
      "moderate",
      `None of the ${scan.imgTotal} images use loading="lazy" — below-the-fold images all load eagerly.`,
      'Add loading="lazy" to images below the fold (keep the LCP/hero image eager).',
      ["img"],
      scan.imgTotal,
    );
  if (scan.rasterCount >= 3 && scan.modernCount === 0)
    add(
      "dom-no-webp",
      "moderate",
      `${scan.rasterCount} images resolve to JPEG/PNG/GIF by URL and none to WebP/AVIF (extension-based check — a CDN content-negotiating formats would not show here; verify the actual response types).`,
      "Serve WebP (with fallbacks via <picture>) as the primary image format.",
      ["img"],
      scan.rasterCount,
    );
  if (scan.selfHostedVideos.length > 0)
    add(
      "dom-selfhosted-video",
      "minor",
      `${scan.selfHostedVideos.length} <video> element(s) load from direct file sources (${scan.selfHostedVideos.join(", ")}) — adaptive delivery by device/speed is not automatic for these; the checklist notes YouTube/Vimeo hosting provides it by default.`,
      "Verify adaptive bitrate delivery for self-hosted video, or host public videos on YouTube/Vimeo.",
      ["video"],
      scan.selfHostedVideos.length,
    );

  return findings;
}
