# Publishing runbook — Stage 2 step 8

> **DONE 2026-07-13.** Both packages are live: [`@dlsforge/aegov-rules-core@0.1.0`](https://www.npmjs.com/package/@dlsforge/aegov-rules-core) and [`@dlsforge/aegov-audit@0.0.1`](https://www.npmjs.com/package/@dlsforge/aegov-audit), published by Alam (`alamkhanak`), verified by a clean registry install + functional run (`--fail-on critical` → exit 1 on the seeded fixture). Post-publish cleanups landed: single-tarball G2 flow restored, action README caveat dropped, releases tagged. This file stays as the runbook for future releases.
>
> **`@dlsforge/aegov-mcp@0.1.1` PUBLISHED 2026-07-22** — the deferred shared-core republish, un-deferred because the official MCP Registry validates ownership via the `mcpName` field inside the published package (see MCP-REGISTRY-SUBMISSIONS.md). Verified: clean install, real MCP client connect, all 7 tools, `listComponents` serves the catalogue. Tagged `aegov-mcp-v0.1.1`. All three packages now ship from the shared core.
>
> **`@dlsforge/aegov-audit@0.1.0` PUBLISHED 2026-07-22** (Stage 2B/2C release: coverage 14 → 61, xlsx output, artifacts bundle, library exports surface; new pinned dep `html-validate@11.5.6`). Published by Alam with a granular access token — note: plain `npm publish` after a browser `npm login` 403s ("Two-factor authentication … required"); either pass `--otp=<code>` or use a granular token with **Bypass 2FA** enabled, then `npm config delete //registry.npmjs.org/:_authToken` and revoke the token. Verified: clean registry install, bin runs, library + deep-dist imports resolve, seeded fixture → `--fail-on moderate` exit 1. Tagged `aegov-audit-v0.1.0`.

The exact sequence to publish the packages to npm under `@dlsforge`.

> **Order is not optional.** `@dlsforge/aegov-rules-core` must publish **first** — `@dlsforge/aegov-audit` depends on it at `0.1.0` and will not resolve from a clean install until the core is on the registry.

> ## Pending release — adversarial-pass patch: core 0.2.1, mcp 0.2.2, audit 0.2.2 (added 2026-07-30)
>
> Commit `80c2cf9` fixed six real defects that the registry still carries.
> The repo is bumped, gated, and awaiting `npm publish`.
>
> | Package | Registry | Repo | Why it moves |
> |---|---|---|---|
> | `@dlsforge/aegov-rules-core` | 0.2.0 | **0.2.1** | Class tokenizer: uppercase `CLASS=` bypassed class validation entirely, while the `\b` boundary flagged `data-class`/`ng-class`/`:class`/`[class]` on valid markup (whitelist lookbehind + `i` flag). `checkBlockContracts`: a probe key the consumer never reported was read as 0 and reported VIOLATED — now not-applicable; an explicit 0 stays a violation |
> | `@dlsforge/aegov-mcp` | 0.2.1 | **0.2.2** | No source change — repins core `0.2.1` exactly so `validate_snippet` ships the tokenizer fix |
> | `@dlsforge/aegov-audit` | 0.2.1 | **0.2.2** | Unknown flags no longer run a silent-green audit (exit 2); a directory target no longer audits Chromium's file-listing page (exit 2); `--version` added (reads package.json at runtime); typed CLI errors instead of raw stack traces; `--xlsx-template` validated at parse time, not after the audit. Repins core `0.2.1` |
>
> **Core first, as always.** Publish + verify order:
>
> ```sh
> npm publish -w @dlsforge/aegov-rules-core
> npm view @dlsforge/aegov-rules-core version   # must print 0.2.1 before continuing
> npm publish -w @dlsforge/aegov-mcp
> npm publish -w @dlsforge/aegov-audit
> ```
>
> While the core is unpublished, the mcp packaging probe again installs BOTH
> workspace tarballs (`test/helpers/tarballs.mjs`, npm `overrides`). **After the
> core publishes, drop `overrides` + `packCore` there** to restore the
> single-tarball flow, which additionally proves the real
> `npm install @dlsforge/aegov-mcp` path.
>
> Post-publish, beyond the standard clean-room verification below:
>
> 1. Tag and push: `aegov-rules-core-v0.2.1`, `aegov-mcp-v0.2.2`, `aegov-audit-v0.2.2`.
> 2. Rebuild the `.mcpb` (`node packages/aegov-mcp/scripts/build-mcpb.mjs` — it
>    stages the PUBLISHED artifact) and attach it to a fresh GitHub release
>    `aegov-mcp-v0.2.2`, marked Latest.
> 3. **Official MCP Registry refresh** — the registry entry still shows 0.1.1
>    (missed during the 0.2.x releases; `server.json` is now 0.2.2). Needs the
>    Owner-role + classic `read:org` PAT path from MCP-REGISTRY-SUBMISSIONS.md §1
>    (the old 7-day PAT has expired), then `mcp-publisher publish` from
>    `packages/aegov-mcp`.
> 4. Release-specific clean-room checks — the six fixes, as a user sees them:
>    - core / `validate_snippet`: `<div CLASS="aegov-fake">x</div>` must be
>      REJECTED (uppercase attribute caught); `<div data-class="aegov-x">x</div>`
>      must NOT raise the unknown-class error; `<header CLASS="aegov-header"></header>`
>      must fire the header block contract.
>    - audit: `npx aegov-audit --version` prints the published version, exit 0 ·
>      an unknown flag (`--lighthose`) exits 2 · a directory target exits 2 ·
>      `--xlsx-template nope.xlsx` fails at parse time, before any audit work ·
>      `--help` still exits 0.
>    - MCP client: `serverInfo.version` must report 0.2.2; the resolved
>      `@dlsforge/aegov-rules-core` must be 0.2.1.
> 5. Revoke the Bypass-2FA npm token — or consciously keep it for the pending
>    Arabic-pack patch window and revoke after that.

> ## ~~Pending release — 0.2.0 across all three~~ SHIPPED 2026-07-29
>
> Landed as `rules-core@0.2.0`, then `aegov-mcp@0.2.0`/`aegov-audit@0.2.0` with
> same-day `0.2.1` patches for both dependents after the mandatory clean-room
> verification caught two live defects (stale hardcoded `serverInfo.version`;
> `--help` exiting 2). All five tags pushed; `.mcpb` attached to the
> `aegov-mcp-v0.2.1` GitHub release. Single-tarball probe flow restored
> post-publish. Historical block kept as written:
>
> The repo is ahead of the registry and the three packages are now **coupled**: both dependents call core APIs added after `0.1.0`.
>
> | Package | Registry | Repo | Why it moves |
> |---|---|---|---|
> | `@dlsforge/aegov-rules-core` | 0.1.0 | **0.2.0** | Block conformance contracts; catalogue `schemaVersion` 3 → 4; new exports (`blockProbeSpec`, `checkBlockContracts`, `checkBlockSnippet`, `staleBlockContracts`) |
> | `@dlsforge/aegov-audit` | 0.1.0 | **0.2.0** | Machine-checked items 61 → 66 (TDRA 3.19–3.22, 2.40) |
> | `@dlsforge/aegov-mcp` | 0.1.1 | **0.2.0** | `validate_snippet` checks block contracts |
>
> **Core first, as always** — the dependents pin it exactly at `0.2.0`, so neither installs from a clean registry until it lands.
>
> While the core is unpublished, the mcp packaging probe installs BOTH workspace tarballs (`test/helpers/tarballs.mjs`, npm `overrides`). **After the core publishes, drop `overrides` + `packCore` there** to restore the single-tarball flow, which additionally proves the real `npm install @dlsforge/aegov-mcp` path.
>
> Also after publishing mcp: rebuild the `.mcpb` (`node packages/aegov-mcp/scripts/build-mcpb.mjs`, it stages the published artifact) and attach it to a fresh GitHub release, as done for [aegov-mcp-v0.1.1](https://github.com/dlsforge/aegov-dls-mcp/releases/tag/aegov-mcp-v0.1.1).
>
> **Deferred (Alam's decision, locked):** `@dlsforge/aegov-mcp@0.1.1` (the shared-core version) does **not** publish now. The live `0.1.0` keeps serving existing users untouched.

## Pre-flight (done)

- READMEs written for all three packages; root README updated.
- `LICENSE` present in every package (added to aegov-audit this step).
- Dry-run `npm pack` verified for both packages — tarball contents below.
- Full gate green: 146/146 tests, mcp evals 10/10, audit evals 8/8, smoke 19/19, validate OK.
- `prepack` on every package runs `tsc`, so a fresh clone builds before packing (publish-hygiene test G2/G3).

### What ships

| Package | Version | Tarball | Notable contents |
|---|---|---|---|
| `@dlsforge/aegov-rules-core` | 0.1.0 | ~124 kB, 17 files | `dist/`, `catalog/catalog.json` + `uaepass.json`, README, LICENSE |
| `@dlsforge/aegov-audit` | 0.0.1 | ~41 kB, 42 files | `dist/`, `reference/tdra-assessment-criteria.json`, README, LICENSE |

The reusable GitHub Action (`packages/aegov-audit/action/`) is intentionally **not** in the npm tarball — it is consumed from GitHub as `dlsforge/aegov-dls-mcp/packages/aegov-audit/action@<ref>`.

## Publish (Alam runs these)

On Windows use `npm.cmd`. Authenticate first (2FA-or-token, the Stage 1 flow):

```sh
npm whoami            # confirm you're logged in as the @dlsforge owner/maintainer
# if not: npm login   (or set NPM_TOKEN / .npmrc with an automation token)
```

Then, from the repo root:

```sh
# 1) core FIRST — audit depends on it
npm publish -w @dlsforge/aegov-rules-core

# 2) verify it resolves before publishing the dependent
npm view @dlsforge/aegov-rules-core version     # should print 0.1.0

# 3) the auditor
npm publish -w @dlsforge/aegov-audit
```

`publishConfig.access` is `public` in both, so no `--access public` flag is needed. `prepack` builds automatically; do not hand-build first.

## Post-publish cleanup (code changes — do after the registry confirms both)

1. **Restore the single-tarball G2 flow.** The clean-install test installs both tarballs (rules-core then mcp) because the core was unpublished. With the core live, revert to resolving the core from the registry — see `packages/aegov-mcp/test/helpers/tarballs.mjs` and STAGE2-HANDOFF §11.
2. **Switch the GitHub Action's default install path.** `action.yml` currently needs `install-spec` tarballs (the self-test uses them) because nothing was on npm. With both published, the default `version: latest` install of `@dlsforge/aegov-audit@<version>` resolves on its own — update `action/README.md` to drop the tarball caveat, and pin a real default version.
3. **Tag the release** (e.g. `git tag aegov-audit-v0.0.1 && git push --tags`) so the Action's `@<ref>` consumers have a stable pin.

## Carry-overs (independent of publishing)

- **Arabic native-speaker review** — all Arabic strings in fixtures and generated report copy are machine-generated and flagged for it.
- **MCP-registry listings** — Stage 1 post-publish TODO, still open.
- **`@dlsforge/aegov-mcp@0.1.1`** — republish whenever Alam decides; bump is already staged locally.

## Verify live (after publish) — MANDATORY, from a clean room

A green monorepo says nothing about the published artifact. On 2026-07-29 this
step caught two defects with passing tests behind them: the MCP server reported
a stale hardcoded `0.1.1` to every client while shipping 0.2.0, and
`aegov-audit --help` exited 2. Both were invisible in the workspace and obvious
the moment a user installed the thing.

**Never verify from the workspace.** Install from the registry into an empty
directory and exercise it as a user would.

```sh
npm view @dlsforge/aegov-rules-core version
npm view @dlsforge/aegov-mcp version
npm view @dlsforge/aegov-audit version

# clean room — an empty dir, nothing linked
mkdir /tmp/verify && cd /tmp/verify && echo '{"private":true}' > package.json

npm install @dlsforge/aegov-mcp

# The core's exports map deliberately exposes only "." — subpath requires like
# `@dlsforge/aegov-rules-core/package.json` or `/catalog/catalog.json` throw
# ERR_PACKAGE_PATH_NOT_EXPORTED. (Earlier revisions of this runbook prescribed
# exactly those, and they never worked; corrected 2026-07-30 against the
# published 0.2.1.) Read the resolved version off disk, and the catalogue
# through the public API:
node -e "console.log(JSON.parse(require('fs').readFileSync('node_modules/@dlsforge/aegov-rules-core/package.json','utf8')).version)"
node --input-type=module -e "import {loadCatalog} from '@dlsforge/aegov-rules-core';const c=loadCatalog();console.log(c.meta.schemaVersion, c.meta.generatedFrom.version, c.blockContracts?.length)"

npm install @dlsforge/aegov-audit
npx aegov-audit --help ; echo "exit=$?"     # must be 0
npx aegov-audit        ; echo "exit=$?"     # no target: must be 2
```

Then connect a **real MCP client** to the installed server and check what it is
actually told — `serverInfo.version` must match the published version, and
`tools/list` must return all seven. Calling one tool that exercises the release's
headline change is worth the extra minute.

Check what the user sees, not just that it starts: **reported version, exit
codes, resolved dependency versions, tool inventory.**
