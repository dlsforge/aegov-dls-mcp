// Builds the .mcpb bundle (MCP Bundle, manifest spec 0.3) for Smithery and
// Claude Desktop one-click install. Stages the PUBLISHED npm artifact — never
// the working tree — so the bundle ships exactly the bits verified at release.
//
// Usage: node scripts/build-mcpb.mjs
// Output: mcpb-dist/aegov-mcp-<version>.mcpb (gitignored)

import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const version = pkg.version;

const stageDir = join(pkgDir, 'mcpb-build');
const outDir = join(pkgDir, 'mcpb-dist');
const outFile = join(outDir, `aegov-mcp-${version}.mcpb`);

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// Stage the published artifact + production deps from the npm registry.
writeFileSync(join(stageDir, 'package.json'), JSON.stringify({ private: true }, null, 2));
run(`npm install @dlsforge/aegov-mcp@${version} --omit=dev --no-audit --no-fund --ignore-scripts`, stageDir);

const installedPkg = JSON.parse(
  readFileSync(join(stageDir, 'node_modules', '@dlsforge', 'aegov-mcp', 'package.json'), 'utf8'),
);
if (installedPkg.version !== version) {
  throw new Error(`staged ${installedPkg.version}, expected ${version}`);
}

const entry = 'node_modules/@dlsforge/aegov-mcp/dist/index.js';
if (!existsSync(join(stageDir, entry))) throw new Error(`entry point missing: ${entry}`);

// Ask the staged server for its real tool list (MCP tools/list over stdio) so
// the manifest ships full MCP-format tool objects. Smithery's deploy API needs
// them: {name, description}-only entries 400 ("expected object" per tool =
// missing inputSchema) and omitting tools 400s too ("No values to set").
async function fetchToolList() {
  const srv = spawn('node', [join(stageDir, entry)], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '';
  const pending = new Map();
  srv.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    }
  });
  const rpc = (id, method, params) =>
    new Promise((res, rej) => {
      pending.set(id, res);
      setTimeout(() => rej(new Error(`timeout on ${method}`)), 15000);
      srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  await rpc(1, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'build-mcpb', version: '0.0.0' },
  });
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const res = await rpc(2, 'tools/list', {});
  srv.kill();
  return res.result.tools;
}

const tools = await fetchToolList();
if (!Array.isArray(tools) || tools.length === 0) throw new Error('tools/list returned no tools');
console.log(`Introspected ${tools.length} tools from the staged server: ${tools.map((t) => t.name).join(', ')}`);

const manifest = {
  manifest_version: '0.3',
  name: 'aegov-mcp',
  display_name: 'AEGOV DLS (UAE Design System)',
  version,
  description:
    'UAE Design System (AEGOV DLS) for AI assistants: components, tokens, UAE PASS & Emirates ID scaffolds, snippet validation. Not TDRA-official.',
  long_description:
    'Gives AI coding assistants a machine-readable model of the UAE Design System (AEGOV DLS v3): 27 verified component class-roots, resolved design tokens, and UAE-specific scaffolds — mandatory UAE PASS login blocks, masked & pattern-validated Emirates ID fields (784-XXXX-XXXXXXX-X), Arabic/RTL-first bilingual structure, DMY dates. `validate_snippet` checks generated markup against the same rules. Runs fully local over stdio — no API keys, no network calls at runtime, no telemetry. MIT. Community project — not affiliated with or endorsed by TDRA.',
  author: { name: 'Alam Khan Durrani', url: 'https://github.com/AlamKhanAk' },
  repository: { type: 'git', url: 'https://github.com/dlsforge/aegov-dls-mcp.git' },
  homepage: 'https://github.com/dlsforge/aegov-dls-mcp#readme',
  support: 'https://github.com/dlsforge/aegov-dls-mcp/issues',
  license: 'MIT',
  keywords: ['uae', 'aegov', 'design-system', 'uae-pass', 'emirates-id', 'government', 'accessibility', 'rtl'],
  server: {
    type: 'node',
    entry_point: entry,
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/' + entry],
    },
  },
  // MCPB spec 0.3 only allows {name, description} per tool — the validator
  // rejects inputSchema/title/execution. Smithery's variant re-adds them below.
  tools: tools.map((t) => ({ name: t.name, ...(t.description ? { description: t.description } : {}) })),
  compatibility: { runtimes: { node: '>=18' } },
};
writeFileSync(join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

run(`npx --yes @anthropic-ai/mcpb@2.1.2 validate "${join(stageDir, 'manifest.json')}"`, pkgDir);
run(`npx --yes @anthropic-ai/mcpb@2.1.2 pack "${stageDir}" "${outFile}"`, pkgDir);

// Smithery variant: same bundle, but manifest.tools carries the FULL MCP tool
// objects from tools/list. Smithery's deploy API requires inputSchema per tool
// (400 "expected object" without it) and at least one serverCard field
// (400 "No values to set" when tools are omitted) — verified 2026-07-25.
// The MCPB validator rejects those keys, so this variant is zipped directly
// (bsdtar --format zip); a .mcpb is a plain zip archive.
const smitheryOut = join(outDir, `aegov-mcp-${version}-smithery.mcpb`);
writeFileSync(join(stageDir, 'manifest.json'), JSON.stringify({ ...manifest, tools }, null, 2));
rmSync(smitheryOut, { force: true });
run(`tar --format zip -cf "${smitheryOut}" manifest.json package.json package-lock.json node_modules`, stageDir);

console.log(`\nBuilt ${outFile}`);
console.log(`Built ${smitheryOut} (Smithery variant, full tool schemas)`);
