/**
 * Tarball machinery for the packaging suites.
 *
 * TWO-TARBALL FLOW (re-restored 2026-07-30 for the adversarial-pass patch
 * window). The probe packs BOTH workspaces and forces the local core via an
 * npm `overrides` entry.
 *
 * Why, and when to go back: this package pins @dlsforge/aegov-rules-core at
 * 0.2.1 exactly, which is not on the registry yet — a single-tarball probe
 * would 404 at `npm install` on the unpublished pin. That failure is the truth
 * about publishing (the core must ship first), not a test defect, and testing
 * against the registry's 0.2.0 would only measure the class-tokenizer defect
 * this release fixes. Once the pinned core version is published, dropping
 * `overrides` and `packCore` restores the single-tarball flow, which
 * additionally proves the real `npm install @dlsforge/aegov-mcp` path.
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

/** Pack the core workspace tarball into workDir; returns its file name. */
export function packCore(workDir) {
  return npm(["pack", "--pack-destination", workDir], coreRoot).trim().split(/\r?\n/).pop();
}

/** Pack + install both tarballs into workDir as a clean install probe. */
export function installBoth(workDir) {
  const mcpTar = packMcp(workDir);
  const coreTar = packCore(workDir);
  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify({
      name: "install-probe",
      private: true,
      version: "0.0.0",
      dependencies: {
        "@dlsforge/aegov-mcp": `file:./${mcpTar}`,
      },
      // The mcp tarball pins the core exactly, so a plain dependency entry
      // would not displace it — npm would still fetch the pinned version from
      // the registry. `overrides` is what forces the workspace build in.
      overrides: {
        "@dlsforge/aegov-rules-core": `file:./${coreTar}`,
      },
    }),
  );
  npm(["install", "--no-audit", "--no-fund"], workDir);
}
