/**
 * Tarball machinery for the packaging suites.
 *
 * TWO-TARBALL FLOW (re-restored 2026-07-29). The probe packs BOTH workspaces and
 * forces the local core via an npm `overrides` entry.
 *
 * Why, and when to go back: this package now calls core APIs added after
 * @dlsforge/aegov-rules-core@0.1.0 (`checkBlockSnippet` and the `blockContracts`
 * catalogue), and the version it pins — 0.2.0 — is not on the registry yet. A
 * single-tarball probe would resolve the core from the registry, get 0.1.0, and
 * fail at import with "does not provide an export named 'checkBlockSnippet'" —
 * which is the truth about publishing, not a test defect: **the core must ship
 * before this package can.** Testing against the registry copy here would only
 * measure a stale dependency, so the probe tests the code this repo actually
 * contains. Once the pinned core version is published, dropping `overrides` and
 * `packCore` restores the single-tarball flow, which additionally proves the
 * real `npm install @dlsforge/aegov-mcp` path.
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
