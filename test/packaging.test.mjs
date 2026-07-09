/**
 * Packaging & publish-readiness (test/STAGE1-CHECKLIST.md section G).
 *
 * G1/G3 inspect `npm pack --dry-run` and package.json. G2 is the real thing:
 * pack a tarball, install it into a clean temp directory, and drive the
 * installed server over stdio — proving the catalog path resolution and bin
 * entry work outside the repo, the way an `npx @dlsforge/aegov-mcp` user runs it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectServer } from "./helpers/mcp.mjs";

const repoRoot = process.cwd();
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npm = (args, cwd = repoRoot) =>
  execFileSync(npmCmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });

describe("pack contents (G1)", () => {
  const entries = JSON.parse(npm(["pack", "--dry-run", "--json"]))[0].files.map((f) => f.path);

  test("only dist/, catalog/ and package metadata ship", () => {
    const allowed = /^(dist\/|catalog\/|package\.json$|README(\.md)?$|LICENSE(\.md|\.txt)?$)/i;
    const leaked = entries.filter((p) => !allowed.test(p));
    assert.deepEqual(leaked, [], `unexpected files in the tarball: ${leaked.join(", ")}`);
  });

  test("the load-bearing files are present", () => {
    for (const required of ["dist/index.js", "dist/catalog/load.js", "catalog/catalog.json", "catalog/uaepass.json"]) {
      assert.ok(entries.includes(required), `missing from tarball: ${required}`);
    }
  });

  test("no src/, scripts/, evals/ or inventory/ leak", () => {
    assert.ok(!entries.some((p) => /^(src|scripts|evals|inventory|test)\//.test(p)));
  });
});

describe("package.json publish hygiene (G3)", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

  test("MIT license, engines >=18, bin present", () => {
    assert.equal(pkg.license, "MIT");
    assert.ok(pkg.engines?.node?.includes(">=18"));
    assert.ok(pkg.bin?.["aegov-mcp"]);
  });

  test("all dependencies are exact-pinned (no ^ or ~)", () => {
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      assert.match(version, /^\d/, `${name} is not exact-pinned: ${version}`);
    }
  });
});

describe("clean install from tarball (G2)", () => {
  test("installed package serves the catalogue over stdio", { timeout: 180_000 }, async () => {
    const workDir = mkdtempSync(join(tmpdir(), "aegov-mcp-install-"));
    try {
      const tarName = npm(["pack", "--pack-destination", workDir]).trim().split(/\r?\n/).pop();
      const tarball = join(workDir, tarName);
      assert.ok(existsSync(tarball), `tarball not created: ${tarball}`);

      writeFileSync(
        join(workDir, "package.json"),
        JSON.stringify({ name: "install-probe", private: true, version: "0.0.0" }),
      );
      npm(["install", tarball, "--prefer-offline", "--no-audit", "--no-fund"], workDir);

      const installedEntry = join(workDir, "node_modules", "@dlsforge", "aegov-mcp", "dist", "index.js");
      assert.ok(existsSync(installedEntry), "installed entry point missing");

      // Drive the installed copy from the temp dir — NOT the repo checkout.
      const srv = await connectServer(installedEntry, workDir);
      try {
        const ping = await srv.call("ping", { message: "packed" });
        assert.equal(ping.body, "pong: packed");
        const { body } = await srv.call("listComponents", {});
        assert.equal(body.components.length, 27, "catalogue must load from the installed location");
        const v = await srv.call("validate_snippet", {
          html: '<button class="aegov-btn" type="button">salam</button>',
        });
        assert.equal(v.body.valid, true);
      } finally {
        await srv.close();
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
