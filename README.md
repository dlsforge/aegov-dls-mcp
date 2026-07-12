# DLSForge — UAE Design System (AEGOV DLS) tooling

Community project. **Not affiliated with or endorsed by TDRA.**

npm-workspaces monorepo holding the public, MIT-licensed DLSForge packages:

| Package | What it is | Status |
|---|---|---|
| [`@dlsforge/aegov-rules-core`](packages/aegov-rules-core/) | Machine-readable model of the AEGOV DLS: component schemas, resolved design tokens, catalogue loader, and the DLS rule engine shared by every DLSForge tool. | `0.1.0` — ready to publish |
| [`@dlsforge/aegov-mcp`](packages/aegov-mcp/) | MCP server exposing the core to AI coding assistants — `listComponents`, `getComponent`, `getTokens`, `scaffoldUaePass`, `scaffoldEmiratesId`, `validate_snippet`. | published: `0.1.0` on npm (`0.1.1` shared-core release deferred) |
| [`@dlsforge/aegov-audit`](packages/aegov-audit/) (Mizan) | Compliance & accessibility auditor for UAE government sites (axe-core + Lighthouse + DLS rules over the rendered DOM), consuming the same core. Ships a CLI and a reusable GitHub Action. | `0.0.1` — ready to publish |

The two tools mirror each other: the **MCP server generates** on-standard government UI, **Mizan audits** it — both enforcing the same rules from the shared core, so the standard is defined once.

## The generate → verify loop

```
@dlsforge/aegov-rules-core   ← the standard, defined once (catalogue + rule engine)
        │
        ├── @dlsforge/aegov-mcp     → assistants GENERATE valid government UI
        └── @dlsforge/aegov-audit   → Mizan VERIFIES a finished/in-progress site
```

## Working in this repo

```bash
npm install          # once, at the root — links the workspaces
npm run build        # builds rules-core → mcp → audit (order matters)
npm test             # all suites, every package
npm run evals        # the 10 government-screen evals (mcp)
npm run evals:audit  # Mizan's fixture-site evals (audit)
npm run smoke        # stdio smoke test (mcp)
npm run validate     # catalogue lint + invariants (rules-core)
```

Mizan's suites render pages, so `npx playwright install chromium` is needed once for `npm test` / `npm run evals:audit`.

See `CLAUDE.md` for the hard rules, `STAGE1-HANDOFF.md` / `STAGE2-HANDOFF.md` for the build briefs, and each package's own README for usage.

## License

MIT — see [LICENSE](LICENSE).
