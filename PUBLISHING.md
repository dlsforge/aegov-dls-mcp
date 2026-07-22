# Publishing runbook — Stage 2 step 8

> **DONE 2026-07-13.** Both packages are live: [`@dlsforge/aegov-rules-core@0.1.0`](https://www.npmjs.com/package/@dlsforge/aegov-rules-core) and [`@dlsforge/aegov-audit@0.0.1`](https://www.npmjs.com/package/@dlsforge/aegov-audit), published by Alam (`alamkhanak`), verified by a clean registry install + functional run (`--fail-on critical` → exit 1 on the seeded fixture). Post-publish cleanups landed: single-tarball G2 flow restored, action README caveat dropped, releases tagged. This file stays as the runbook for future releases.
>
> **`@dlsforge/aegov-audit@0.1.0` PUBLISHED 2026-07-22** (Stage 2B/2C release: coverage 14 → 61, xlsx output, artifacts bundle, library exports surface; new pinned dep `html-validate@11.5.6`). Published by Alam with a granular access token — note: plain `npm publish` after a browser `npm login` 403s ("Two-factor authentication … required"); either pass `--otp=<code>` or use a granular token with **Bypass 2FA** enabled, then `npm config delete //registry.npmjs.org/:_authToken` and revoke the token. Verified: clean registry install, bin runs, library + deep-dist imports resolve, seeded fixture → `--fail-on moderate` exit 1. Tagged `aegov-audit-v0.1.0`.

The exact sequence to publish the packages to npm under `@dlsforge`.

> **Order is not optional.** `@dlsforge/aegov-rules-core` must publish **first** — `@dlsforge/aegov-audit` depends on it at `0.1.0` and will not resolve from a clean install until the core is on the registry.
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

## Verify live (after publish)

```sh
npm view @dlsforge/aegov-rules-core
npm view @dlsforge/aegov-audit
npx @dlsforge/aegov-audit --help     # exercises the published bin
```
