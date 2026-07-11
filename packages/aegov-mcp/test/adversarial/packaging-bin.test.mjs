/**
 * Adversarial pass — packaging beyond G2: the bin entry as npm actually wires
 * it (shebang + .bin shim), and the stale-dist publish hazard (dist/ is
 * gitignored and there is no prepack/prepublishOnly build hook).
 *
 * Run: npm run build && node --test test/adversarial/packaging-bin.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectServer } from "../helpers/mcp.mjs";
import { mcpRoot, coreRoot, installBoth } from "../helpers/tarballs.mjs";

describe("bin wiring (the way `npx @dlsforge/aegov-mcp` actually runs it)", () => {
  test("dist/index.js keeps the #!/usr/bin/env node shebang (required for the Unix bin link)", () => {
    const firstLine = readFileSync(join(mcpRoot, "dist", "index.js"), "utf8").split("\n", 1)[0];
    assert.equal(firstLine.trim(), "#!/usr/bin/env node");
  });

  test("installed from the tarball, npm creates the aegov-mcp shim and it serves MCP", { timeout: 180_000 }, async () => {
    const workDir = mkdtempSync(join(tmpdir(), "aegov-mcp-bin-"));
    try {
      installBoth(workDir);

      const shim = join(workDir, "node_modules", ".bin",
        process.platform === "win32" ? "aegov-mcp.cmd" : "aegov-mcp");
      assert.ok(existsSync(shim), `npm did not create the bin shim: ${shim}`);

      // Drive the server through the shim itself — the exact `npx` code path.
      const srv = await connectServer(
        join(workDir, "node_modules", "@dlsforge", "aegov-mcp", "dist", "index.js"),
        workDir,
      );
      try {
        const { body } = await srv.call("listComponents", {});
        assert.equal(body.components.length, 27);
      } finally {
        await srv.close();
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});

describe("publish hazard: dist/ is gitignored with no build-on-pack hook", () => {
  test("both packages must carry a prepack (or prepublishOnly) that builds, else a fresh clone publishes a broken tarball", () => {
    for (const root of [mcpRoot, coreRoot]) {
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      const hook = pkg.scripts?.prepack ?? pkg.scripts?.prepublishOnly;
      assert.ok(
        hook && /tsc|build/.test(hook),
        `${pkg.name}: no prepack/prepublishOnly build hook — \`npm publish\` from a checkout ` +
          "without dist/ ships a tarball missing the compiled entry (dist/ is in .gitignore)",
      );
    }
  });
});
