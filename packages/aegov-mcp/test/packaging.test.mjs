/**
 * Packaging & publish-readiness (test/STAGE1-CHECKLIST.md section G).
 *
 * G1/G1b/G3 inspect `npm pack --dry-run` and package.json. G2 is the real
 * thing: pack the mcp AND rules-core tarballs, install them into a clean temp
 * directory, and drive the installed server over stdio — proving the catalog
 * resolves through the dependency and the bin entry works outside the repo,
 * the way an `npx @dlsforge/aegov-mcp` user runs it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectServer } from "./helpers/mcp.mjs";
import { coreRoot, mcpRoot, installBoth, packDryRunFiles } from "./helpers/tarballs.mjs";

describe("pack contents (G1)", () => {
  const entries = packDryRunFiles();

  test("only dist/ and package metadata ship (catalog comes via @dlsforge/aegov-rules-core)", () => {
    const allowed = /^(dist\/|package\.json$|README(\.md)?$|LICENSE(\.md|\.txt)?$)/i;
    const leaked = entries.filter((p) => !allowed.test(p));
    assert.deepEqual(leaked, [], `unexpected files in the tarball: ${leaked.join(", ")}`);
  });

  test("the load-bearing files are present", () => {
    for (const required of ["dist/index.js"]) {
      assert.ok(entries.includes(required), `missing from tarball: ${required}`);
    }
  });

  test("no src/, scripts/, evals/, inventory/ or catalog/ leak", () => {
    assert.ok(!entries.some((p) => /^(src|scripts|evals|inventory|test|catalog)\//.test(p)));
  });
});

describe("pack contents of the shared core (G1b)", () => {
  const entries = packDryRunFiles(coreRoot);

  test("rules-core ships dist/, catalog/ and package metadata only", () => {
    const allowed = /^(dist\/|catalog\/|package\.json$|README(\.md)?$|LICENSE(\.md|\.txt)?$)/i;
    const leaked = entries.filter((p) => !allowed.test(p));
    assert.deepEqual(leaked, [], `unexpected files in the core tarball: ${leaked.join(", ")}`);
  });

  test("the catalogue, loader and rule engine ship in the core", () => {
    for (const required of [
      "dist/index.js",
      "dist/catalog/load.js",
      "dist/rules/engine.js",
      "catalog/catalog.json",
      "catalog/uaepass.json",
    ]) {
      assert.ok(entries.includes(required), `missing from core tarball: ${required}`);
    }
  });
});

describe("package.json publish hygiene (G3)", () => {
  const pkg = JSON.parse(readFileSync(join(mcpRoot, "package.json"), "utf8"));
  const corePkg = JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8"));

  test("MIT license, engines >=18, bin present", () => {
    assert.equal(pkg.license, "MIT");
    assert.ok(pkg.engines?.node?.includes(">=18"));
    assert.ok(pkg.bin?.["aegov-mcp"]);
  });

  test("all dependencies are exact-pinned (no ^ or ~), in both packages", () => {
    for (const [name, version] of Object.entries({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...corePkg.dependencies,
      ...corePkg.devDependencies,
    })) {
      assert.match(version, /^\d/, `${name} is not exact-pinned: ${version}`);
    }
  });
});

describe("clean install from tarball (G2)", () => {
  test("installed package serves the catalogue over stdio", { timeout: 180_000 }, async () => {
    const workDir = mkdtempSync(join(tmpdir(), "aegov-mcp-install-"));
    try {
      installBoth(workDir);

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
