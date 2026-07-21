/**
 * `--artifacts <dir>` — a deterministic evidence bundle for downstream
 * review tooling (the Studio's judgment lane consumes it; any human reviewer
 * can too). Everything here is EXTRACTION from the rendered page — no LLM,
 * no network beyond the page already loaded, MIT-safe:
 *
 *   screenshots/  full-page PNGs at the default viewport and at every
 *                 design-system breakpoint (the same set the breakpoint
 *                 sweep checks)
 *   copy.json     title/lang/dir, the heading outline, and the visible text
 *                 (Arabic text is extracted page content, not generated —
 *                 the native-review rule applies to whoever judges it)
 *   images.json   every <img>: resolved src, alt, rendered size, loading
 *                 attribute, decorative markers
 *   manifest.json what was captured, by which tool version, when, and from
 *                 which URL — so the bundle is self-describing evidence
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import { DLS_BREAKPOINTS } from "./engines/interaction.js";

const require = createRequire(import.meta.url);
const own = require("../package.json") as { name: string; version: string };

const VISIBLE_TEXT_CAP = 200_000;
const IMAGE_CAP = 500;

export type ArtifactsManifest = {
  tool: { name: string; version: string };
  target: string;
  finalUrl: string;
  generatedAt: string;
  screenshots: Array<{ file: string; width: number; note: string }>;
  files: string[];
  note: string;
};

type CopyExtract = {
  title: string;
  lang: string;
  dir: string;
  headings: Array<{ level: number; text: string }>;
  visibleText: string;
  truncated: boolean;
};

type ImageEntry = {
  src: string;
  alt: string | null;
  width: number;
  height: number;
  loading: string | null;
  ariaHidden: boolean;
};

/**
 * Capture the bundle into `dir` (created if missing). The caller owns the
 * page; the viewport is restored before returning. Individual screenshot
 * failures are recorded in the manifest note rather than aborting the audit.
 */
export async function writeArtifacts(
  page: Page,
  dir: string,
  opts: { target: string; finalUrl: string },
): Promise<ArtifactsManifest> {
  const root = resolve(dir);
  mkdirSync(join(root, "screenshots"), { recursive: true });

  const copy = (await page.evaluate((cap: number) => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
      .slice(0, 200)
      .map((h) => ({
        level: Number(h.tagName[1]),
        text: (h.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 300),
      }));
    const raw = (document.body?.innerText ?? "").replace(/\n{3,}/g, "\n\n");
    return {
      title: document.title,
      lang: document.documentElement.lang || "",
      dir: document.documentElement.dir || "",
      headings,
      visibleText: raw.slice(0, cap),
      truncated: raw.length > cap,
    };
  }, VISIBLE_TEXT_CAP)) as CopyExtract;

  const images = (await page.evaluate((cap: number) => {
    return Array.from(document.querySelectorAll("img"))
      .slice(0, cap)
      .map((img) => {
        const r = img.getBoundingClientRect();
        return {
          src: (img.currentSrc || img.src || "").slice(0, 500),
          alt: img.hasAttribute("alt") ? img.getAttribute("alt") : null,
          width: Math.round(r.width),
          height: Math.round(r.height),
          loading: img.getAttribute("loading"),
          ariaHidden: img.getAttribute("aria-hidden") === "true",
        };
      });
  }, IMAGE_CAP)) as ImageEntry[];

  const screenshots: ArtifactsManifest["screenshots"] = [];
  const problems: string[] = [];
  const vp = page.viewportSize();
  const shoot = async (file: string, width: number, note: string) => {
    try {
      await page.screenshot({ path: join(root, "screenshots", file), fullPage: true });
      screenshots.push({ file: `screenshots/${file}`, width, note });
    } catch (err) {
      problems.push(`${file}: ${String(err).slice(0, 120)}`);
    }
  };
  if (vp) {
    await shoot(`default-${vp.width}px.png`, vp.width, "default audit viewport");
    for (const bp of DLS_BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: vp.height });
      await page.waitForTimeout(350);
      await shoot(`bp-${bp.name}-${bp.width}px.png`, bp.width, `design-system breakpoint ${bp.name}`);
    }
    await page.setViewportSize(vp);
    await page.waitForTimeout(100);
  } else {
    problems.push("no viewport — screenshots skipped");
  }

  writeFileSync(join(root, "copy.json"), JSON.stringify(copy, null, 2) + "\n");
  writeFileSync(join(root, "images.json"), JSON.stringify(images, null, 2) + "\n");
  const manifest: ArtifactsManifest = {
    tool: { name: own.name, version: own.version },
    target: opts.target,
    finalUrl: opts.finalUrl,
    generatedAt: new Date().toISOString(),
    screenshots,
    files: ["copy.json", "images.json", ...screenshots.map((s) => s.file)],
    note:
      "Deterministic extraction from the rendered page for downstream review tooling. " +
      "Text (including Arabic) is extracted page content, not generated. " +
      "This bundle is evidence input, never a compliance verdict." +
      (problems.length ? ` Capture problems: ${problems.join("; ")}` : ""),
  };
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
