/**
 * Tarball machinery for the packaging suites.
 *
 * The shared core (@dlsforge/aegov-rules-core) is a workspace sibling and is
 * NOT yet published to npm (the 0.1.1 republish is deferred — STAGE2-HANDOFF
 * §11). Until it is published, install probes must feed npm BOTH tarballs via
 * file: specifiers — the core satisfies the mcp tarball's exact-pinned
 * dependency offline, without touching the registry. When the core is live on
 * npm, this can revert to the single-tarball flow.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

export const mcpRoot = process.cwd();
export const coreRoot = join(mcpRoot, "..", "aegov-rules-core");

export const npm = (args, cwd = mcpRoot) =>
  execFileSync(npmCmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });

/** Pack both workspace tarballs into workDir; returns their file names. */
export function packBoth(workDir) {
  const mcpTar = npm(["pack", "--pack-destination", workDir]).trim().split(/\r?\n/).pop();
  const coreTar = npm(["pack", "--pack-destination", workDir], coreRoot)
    .trim()
    .split(/\r?\n/)
    .pop();
  return { mcpTar, coreTar };
}

/** Pack + install both tarballs into workDir as a clean install probe. */
export function installBoth(workDir) {
  const { mcpTar, coreTar } = packBoth(workDir);
  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify({
      name: "install-probe",
      private: true,
      version: "0.0.0",
      dependencies: {
        "@dlsforge/aegov-rules-core": `file:./${coreTar}`,
        "@dlsforge/aegov-mcp": `file:./${mcpTar}`,
      },
    }),
  );
  npm(["install", "--prefer-offline", "--no-audit", "--no-fund"], workDir);
}
