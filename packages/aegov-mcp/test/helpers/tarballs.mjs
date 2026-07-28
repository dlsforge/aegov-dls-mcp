/**
 * Tarball machinery for the packaging suites.
 *
 * Single-tarball flow (restored again 2026-07-29, once
 * @dlsforge/aegov-rules-core@0.2.0 was on the registry): the probe packs only
 * the mcp tarball and lets npm resolve the exact-pinned core from the registry
 * — the same path a real `npm install @dlsforge/aegov-mcp` takes, so it proves
 * the published dependency actually satisfies this package.
 *
 * It briefly fed npm both tarballs via `overrides` while the pinned core was
 * unpublished. If that is ever needed again (a dependent landing before its
 * core ships), see git history — but prefer publishing the core first: a probe
 * that overrides the dependency stops testing what users get.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

export const mcpRoot = process.cwd();
/** Workspace path of the core — still used by publish-hygiene checks. */
export const coreRoot = join(mcpRoot, "..", "aegov-rules-core");

export const npm = (args, cwd = mcpRoot) =>
  execFileSync(npmCmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });

/**
 * File paths of a `npm pack --dry-run --json` from cwd. npm ≤11 emits an
 * ARRAY of results; npm 12 emits an OBJECT keyed by package name — accept
 * both (the installed npm wins, per the verify-live rule).
 */
export function packDryRunFiles(cwd = mcpRoot) {
  const parsed = JSON.parse(npm(["pack", "--dry-run", "--json"], cwd));
  const result = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  return result.files.map((f) => f.path);
}

/** Pack the mcp workspace tarball into workDir; returns its file name. */
export function packMcp(workDir) {
  return npm(["pack", "--pack-destination", workDir]).trim().split(/\r?\n/).pop();
}

/** Pack + install the mcp tarball into workDir as a clean install probe. */
export function installBoth(workDir) {
  const mcpTar = packMcp(workDir);
  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify({
      name: "install-probe",
      private: true,
      version: "0.0.0",
      dependencies: {
        "@dlsforge/aegov-mcp": `file:./${mcpTar}`,
      },
    }),
  );
  npm(["install", "--no-audit", "--no-fund"], workDir);
}
