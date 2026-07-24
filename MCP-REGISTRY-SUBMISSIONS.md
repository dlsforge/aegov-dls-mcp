# MCP Registry Submissions — @dlsforge/aegov-mcp

> Prepared 2026-07-22 (processes verified live that day — re-check before running, these move fast). Goal: make the MCP server discoverable where assistant users actually look. The **official MCP Registry comes first**; the community directories largely crawl downstream of it and of GitHub/npm.

## 0. Prerequisite: publish `@dlsforge/aegov-mcp@0.1.1` (the deferred republish)

The official registry **verifies ownership by reading an `mcpName` field inside the published npm package**. The live `0.1.0` does not carry it, so listing requires the republish that has been staged and deferred since Stage 2:

- The working tree already has `version: 0.1.1`, the shared `@dlsforge/aegov-rules-core@0.1.0` dependency (live on npm), and now `"mcpName": "io.github.dlsforge/aegov-mcp"` in [`packages/aegov-mcp/package.json`](packages/aegov-mcp/package.json).
- Publish it the same way as aegov-audit 0.1.0 (see PUBLISHING.md — including the granular Bypass-2FA-token lesson):

```sh
npm publish -w @dlsforge/aegov-mcp        # from the repo root
npm view @dlsforge/aegov-mcp version      # should print 0.1.1
git tag aegov-mcp-v0.1.1 && git push --tags
```

Run the full gate first (`npm test && npm run evals && npm run smoke`) — same bar as every release.

## 1. Official MCP Registry (registry.modelcontextprotocol.io)

Everything is prepared: [`packages/aegov-mcp/server.json`](packages/aegov-mcp/server.json) is written against the current schema; its `name` matches the `mcpName` in package.json, and both versions say `0.1.1`.

**Namespace note:** with GitHub authentication the server name must start with `io.github.<account>/`. We use `io.github.dlsforge/…`, which requires authenticating as a GitHub account with access to the **dlsforge** org (you). If the publisher rejects the org namespace, the fallback is renaming both `mcpName` and `server.json → name` to `io.github.<your-username>/aegov-mcp` — but then the npm package must be republished again (the fields must match), so try the org namespace first.

Steps (Windows PowerShell):

```powershell
# install the publisher CLI (per the official quickstart)
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }
Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"
tar xf mcp-publisher.tar.gz mcp-publisher.exe
# put mcp-publisher.exe somewhere on PATH

cd "packages\aegov-mcp"
mcp-publisher login github     # device-code flow in the browser
mcp-publisher publish
```

Verify:

```sh
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.dlsforge/aegov-mcp"
```

Notes:
- The registry hosts **metadata only** — the artifact stays on npm.
- If `publish` complains about the description length or schema drift, run `mcp-publisher init` in the package directory and port our fields onto the freshly generated template.
- Re-publish to the registry on every future npm release (bump both `version` fields in server.json). Registry publishing can later be automated in GitHub Actions (official docs: registry → github-actions).

**Lessons from the 2026-07-23 publish (what actually worked):**
- `description` in server.json is capped at **≤100 chars** by the registry (422 otherwise). Ours is now the short form; the long copy lives in §2 below and the README.
- The org namespace `io.github.dlsforge/*` is granted **only to org Owners** (role `admin`), checked via `GET /user/memberships/orgs` — public org membership is neither necessary nor sufficient.
- `mcp-publisher login github` (device flow) **cannot see org role**: the registry's login app is a GitHub App, which GitHub won't show org memberships for unless installed on the org. OAuth-app policy settings ("Remove restrictions") don't apply to it and don't help.
- **Working path:** classic PAT with only the `read:org` scope, then `mcp-publisher login github --token <PAT>`, then `mcp-publisher publish` from `packages/aegov-mcp`. Use this for every future release; the PAT can be short-lived and deleted right after.

## 2. Community directories (after #1)

Ready-to-paste copy for all of them:

**Name:** AEGOV DLS (UAE Design System) — `@dlsforge/aegov-mcp`

**Short description (~140 chars):**
> UAE Design System (AEGOV DLS) for AI assistants: component catalogue, design tokens, UAE PASS & Emirates ID scaffolds, snippet validation.

**Long description:**
> Gives AI coding assistants a machine-readable model of the UAE Design System (AEGOV DLS v3): 27 verified component class-roots, resolved design tokens, and UAE-specific scaffolds — mandatory UAE PASS login blocks, masked & pattern-validated Emirates ID fields (784-XXXX-XXXXXXX-X), Arabic/RTL-first bilingual structure, DMY dates. `validate_snippet` checks generated markup against the same rules. Built on the shared `@dlsforge/aegov-rules-core`; the same rules power the Mizan compliance auditor (`@dlsforge/aegov-audit`). MIT. Community project — not affiliated with or endorsed by TDRA.

**Tools:** `listComponents`, `getComponent`, `getTokens`, `scaffoldUaePass`, `scaffoldEmiratesId`, `validate_snippet` · **Auth:** none (local stdio; no API keys, no network calls at runtime) · **Install:** `npx @dlsforge/aegov-mcp` · **Repo:** https://github.com/dlsforge/aegov-dls-mcp · **npm:** https://www.npmjs.com/package/@dlsforge/aegov-mcp

Per directory (verified 2026-07-22; UIs change):

| Directory | How | Notes |
|---|---|---|
| **mcp.so** | "Submit" button on mcp.so (or their GitHub submission issue) | Paste the copy above + repo URL. |
| **PulseMCP** | "Submit" in the nav at pulsemcp.com | They also crawl automatically; submitting speeds it up and lets you claim the listing. |
| **Glama** | Auto-indexes GitHub; visit glama.ai/mcp/servers and claim/verify the listing once it appears | Claiming may involve a `glama.json` in the repo or account verification — follow their current docs. |
| **Smithery** | smithery.ai → "Add Server" (account needed) | **Re-verified 2026-07-24: the web form only takes remote HTTP servers now — do NOT fill it.** Local stdio servers are published as an **MCPB bundle** (`.mcpb`, Anthropic's packaged-MCP format): build the bundle, then `smithery mcp publish ./server.mcpb -n <org>/<server>` (or UI upload). Docs: smithery.ai/docs/build/publish.md. Bonus: the same .mcpb gives Claude Desktop one-click install. Alam's Smithery account exists (GitHub login done). |

## 3. What NOT to claim anywhere

- Never "official TDRA tooling" — every listing carries the community disclaimer (it's in both description blocks above).
- No install analytics/telemetry claims to make; the server runs fully local.

## Status

- [x] `@dlsforge/aegov-mcp@0.1.1` published to npm — DONE 2026-07-22, verified (clean install; MCP client connects; all 7 tools; `mcpName` present in the published manifest); tagged `aegov-mcp-v0.1.1`
- [x] Official MCP Registry published — DONE 2026-07-23, verified live via API (`io.github.dlsforge/aegov-mcp` v0.1.1, status active)
- [x] mcp.so submitted — DONE 2026-07-24 (free tier, queued for review; category Developer Tools, author dlsforge, full overview + npx config filled; account: Alam's GitHub login)
- [x] PulseMCP — no manual submission anymore (checked 2026-07-24): they ingest the Official MCP Registry daily, process weekly → listing arrives automatically. FOLLOW-UP: if not visible on pulsemcp.com by ~2026-07-31, email hello@pulsemcp.com
- [x] Glama submitted — DONE 2026-07-24 (Add Server with repo URL, Alam's GitHub login; `glama.json` with maintainer AlamKhanAk committed at repo root, commit e6f8831). FOLLOW-UP: indexing not instant — check `https://glama.ai/api/mcp/v1/servers?query=dlsforge` in a few days, verify listing shows claimed/maintained
- [x] Smithery listed — DONE 2026-07-25: `alamkhandurrani/aegov-mcp` published as a stdio MCPB bundle, release SUCCESS, all 7 tools with schemas verified via `registry.smithery.ai/servers/alamkhandurrani/aegov-mcp`. Page: https://smithery.ai/servers/alamkhandurrani/aegov-mcp
  - **Build:** `packages/aegov-mcp/scripts/build-mcpb.mjs` stages the PUBLISHED npm artifact, introspects tools/list live, emits TWO bundles into `mcpb-dist/` (gitignored): the spec-valid `aegov-mcp-<v>.mcpb` (Claude Desktop / release asset) and `aegov-mcp-<v>-smithery.mcpb` (manifest.tools = full MCP tool objects).
  - **Why two:** Anthropic's MCPB spec 0.3 REJECTS `inputSchema`/`title`/`execution` in manifest tools, while Smithery's deploy API REQUIRES them (400 "expected object" per tool without inputSchema; 400 "No values to set" if tools omitted entirely). Verified against smithery CLI 1.2.0 source: manifest.tools passes through verbatim as the serverCard.
  - **Future releases:** `node scripts/build-mcpb.mjs` then `npx smithery@latest auth login` (browser approve) then `npx smithery@latest mcp publish ./mcpb-dist/aegov-mcp-<v>-smithery.mcpb -n alamkhandurrani/aegov-mcp`.
  - FOLLOW-UP: display name + description are web-UI settings on the server page (deploy payload doesn't carry them) — Alam fills them once.
