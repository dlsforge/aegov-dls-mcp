# DLSForge — UAE Design System (AEGOV DLS) tooling

Community project. **Not affiliated with or endorsed by TDRA.**

npm-workspaces monorepo holding the public, MIT-licensed DLSForge packages:

| Package | What it is | Status |
|---|---|---|
| [`@dlsforge/aegov-rules-core`](packages/aegov-rules-core/) | Machine-readable model of the AEGOV DLS: component schemas, resolved design tokens, catalogue loader, and the DLS rule engine shared by every DLSForge tool. | unpublished (extracted in Stage 2 step 0) |
| [`@dlsforge/aegov-mcp`](packages/aegov-mcp/) | MCP server exposing the core to AI coding assistants — `listComponents`, `getComponent`, `getTokens`, `scaffoldUaePass`, `scaffoldEmiratesId`, `validate_snippet`. | published: `0.1.0` on npm (`0.1.1` shared-core release pending) |
| `@dlsforge/aegov-audit` (Mizan) | Compliance & accessibility auditor for UAE government sites, consuming the same core. | in development (Stage 2) |

## Working in this repo

```bash
npm install          # once, at the root — links the workspaces
npm run build        # builds rules-core, then mcp (order matters)
npm test             # all suites, both packages
npm run evals        # the 10 government-screen evals (mcp)
npm run smoke        # stdio smoke test (mcp)
npm run validate     # catalogue lint + invariants (rules-core)
```

See `CLAUDE.md` for the hard rules, `STAGE1-HANDOFF.md` / `STAGE2-HANDOFF.md` for the build briefs, and each package's own README for usage.

## License

MIT — see [LICENSE](LICENSE).
