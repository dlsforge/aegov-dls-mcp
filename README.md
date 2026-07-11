# @dlsforge/aegov-mcp

**MCP server for the UAE Design System (AEGOV DLS)** — gives AI coding assistants
(Claude Code, Cursor, GitHub Copilot, and any other MCP client) a machine-readable,
version-pinned model of the official UAE government design system, so they generate
valid, on-standard government UI instead of generic web code.

> **Community project. Not affiliated with or endorsed by TDRA.**

The server never invents design rules. It serves a structured catalogue introspected
from the pinned [`@aegov/design-system`](https://www.npmjs.com/package/@aegov/design-system)
npm package (currently **3.0.7**) plus clearly-marked documentation snapshots from
[designsystem.gov.ae](https://designsystem.gov.ae) and [docs.uaepass.ae](https://docs.uaepass.ae).

## Quick start

The package runs over stdio via `npx` — no install step needed beyond registering it
with your assistant.

**Claude Code**

```sh
claude mcp add aegov-dls -- npx -y @dlsforge/aegov-mcp
```

**Cursor** — add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "aegov-dls": {
      "command": "npx",
      "args": ["-y", "@dlsforge/aegov-mcp"]
    }
  }
}
```

**VS Code / GitHub Copilot** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "aegov-dls": {
      "command": "npx",
      "args": ["-y", "@dlsforge/aegov-mcp"]
    }
  }
}
```

Then ask your assistant to build a UAE government screen — a service page, an
application form, a login — and it will discover and use the tools below.

## Tools

| Tool | What it does |
|------|--------------|
| `listComponents` | Enumerate every component, block, pattern and docs-only artifact the catalogue knows, with the standard page furniture (header / footer / page-rating) an assistant should include on full pages. |
| `getComponent` | Full record for one artifact: official markup, variant examples, rules (accessibility, RTL/bilingual, usage), class inventory, provenance. Accepts class-roots (`aegov-btn`), docs names (`Button`), block/pattern ids (`header`, `emirates-id-input`), or member classes. |
| `getTokens` | The design system's resolved design tokens (223 CSS custom properties: OKLCH colour palettes, typography, shadows, containers) — the only values generated UI should use. |
| `scaffoldUaePass` | Official-guideline UAE Pass button markup (UAE Pass is the mandatory national digital identity for government login): documented wording variants, permitted appearances, OAuth2 authorize template with staging/production endpoints, official asset links. |
| `scaffoldEmiratesId` | The standard Emirates ID form control: accepts 15 raw digits, auto-formats to `784-XXXX-XXXXXXX-X`, validates the mandatory pattern, bilingual labels, masked display with explicit reveal. |
| `validate_snippet` | Validate generated HTML against the standard: every `aegov-*` class verified against the pinned package (certain), other classes checked against official docs usage (best-effort), plus UAE-specific checks — Emirates ID pattern + masking, `img` alt, Arabic RTL handling, DMY dates. |
| `ping` | Health check. |

## What the assistant is held to

These are enforced through the catalogue rules, the scaffolders, and `validate_snippet`:

- **WCAG 2.2 AA** accessibility target.
- **UAE Pass** for any login — it is mandatory, not optional.
- **Emirates ID** format `784-NNNN-NNNNNNN-N` with pattern validation, and masking
  (`784-1945-XXXXXXX-X`) for any displayed ID.
- **Arabic / RTL first-class** — correct `dir` handling, bilingual-ready structure.
- **DMY dates** — unambiguously month-first dates are rejected.
- **Tokens only** — official component classes and design tokens, never arbitrary values,
  including the handful of classes that appear in the official docs but do **not** ship
  in the pinned package (served with a `driftWarning`, rejected by the validator).

## Trust model (read this before relying on it)

Every record carries provenance, and the two tiers are deliberately distinct:

- **Package tier — authoritative.** Components and design tokens are introspected from
  the compiled CSS of the exact pinned `@aegov/design-system` version. Class identity
  at this tier is certain.
- **Docs tier — provisional.** Blocks, patterns, usage rules and UAE Pass guidance do
  not ship as code; they are snapshots of the official documentation sites. Every
  docs-tier record carries its source URL, retrieval date, and a needs-revalidation
  flag. Verify high-stakes content (Emirates ID, UAE Pass) against the live sources
  before shipping.

**Arabic content:** Arabic strings emitted by the scaffolders are machine-generated and
explicitly flagged — they require native-speaker review before shipping. Arabic text
inside captured official docs examples is preserved verbatim, never edited.

## Development

```sh
npm install
npm run build      # compile the server to dist/
npm test           # full suite over real stdio (protocol, tools, packaging, adversarial)
npm run smoke      # quick protocol/tool checks
npm run evals      # the 10-screen government-UI exit test
npm run validate   # lint + invariant checks over the shipped catalogue artifacts
```

The catalogue is generated, never hand-edited: `npm run inventory` re-introspects the
installed design-system package; `npm run docs:fetch` / `docs:extract` and
`uaepass:fetch` / `uaepass:extract` refresh the documentation snapshots; `npm run catalog`
and `uaepass:build` rebuild the shipped artifacts, each gated by the validating lint.

Dependencies are exact-pinned. Bumping `@aegov/design-system` is a deliberate act:
bump, regenerate the inventory and catalogue, re-run the full suite and evals.

## License

[MIT](./LICENSE) — matching the design system's own licence.

This is a community project, not official TDRA tooling. The UAE Design System itself
belongs to its authors; this package only serves a machine-readable model of it to
development tools.
