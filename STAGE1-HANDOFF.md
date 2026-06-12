# Stage 1 Handoff — AEGOV DLS MCP Server

> **Purpose of this file.** This is the build brief for Stage 1 of the UAE Design System AI Toolkit. It is written to live at the root of the project repository so that Claude Code (or any AI coding assistant) can read it and start building with the full context already in hand. Read this top to bottom before writing code.

---

## 1. What we are building, in one paragraph

An **MCP (Model Context Protocol) server** that exposes the official **UAE Design System** (the AEGOV DLS, package `@aegov/design-system`, version 3.x, MIT-licensed, TailwindCSS 4-based) to AI coding assistants such as Cursor, Claude Code, and GitHub Copilot. When a government developer asks their assistant to build UI, the assistant should produce **correct, on-standard UAE government components** — including the UAE-specific patterns (Emirates ID input, mandatory UAE Pass login, Arabic / right-to-left defaults) — instead of generic web code. The server never invents design rules; it serves them from a structured catalogue parsed from the official source.

## 2. Why this matters (context you should not lose)

- The design system is **mandatory for UAE federal government websites** and is the single source of truth for components, tokens, Arabic/RTL behaviour, and accessibility.
- TDRA (the regulator) has **publicly invited** exactly this kind of tool — its own guidance says to "ground your AI tools in the UAE Design System."
- **No AEGOV-specific MCP server exists yet.** This is greenfield. Build it cleanly and openly.
- Keep a **human in the loop** (a UAE AI Charter principle). The server assists; it does not make final calls on quality, especially Arabic correctness.

## 3. Definition of done (the exit test — do not declare success without it)

> Across roughly **ten common government screens** (e.g. a service landing page, a multi-step application form, a login screen, a contact page, a card grid of services, a data table, an alert/notification, a hero, a footer, and an Emirates-ID entry step), an AI assistant connected to this server **reliably emits valid, on-standard AEGOV DLS components** — correct class names, correct structure, RTL-aware, bilingual-ready — **without the developer hand-correcting the output.**

Keep a small `/evals` folder with these ten prompts and the expected component output so success is measurable, not a matter of opinion.

## 4. Tech stack (all free / open source)

- **Node.js + TypeScript** — runtime and language. TypeScript is required: the catalogue must be strongly typed so the tools return reliable, well-shaped data.
- **Official MCP SDK** (`@modelcontextprotocol/sdk`) — the standard way to expose tools and resources to AI assistants. Use the current stable version; check its docs at build time rather than relying on memory, as the SDK evolves.
- **The design system itself** — `@aegov/design-system` (and, if useful, the React port `@aegov/design-system-react`) pulled from npm/GitHub as the source to parse.
- **A small parsing layer** — custom code that reads the package's CSS/tokens and the documented component markup into a structured JSON catalogue.
- **npm + GitHub** — for open-source distribution and version control. Publishing openly is part of the credibility strategy, not an afterthought.

## 5. Recommended repository structure

```
aegov-dls-mcp/
├─ README.md                  # what it is, how to install in Cursor/Claude Code/Copilot
├─ STAGE1-HANDOFF.md          # this file
├─ FUTURE-STAGES-NOTES.md     # reference notes for Stages 2 & 3
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ index.ts                # MCP server entry point; registers tools & resources
│  ├─ catalog/
│  │  ├─ parse.ts             # reads @aegov/design-system into structured data
│  │  ├─ catalog.json         # generated: components, blocks, patterns, tokens
│  │  └─ types.ts             # TypeScript types for the catalogue
│  ├─ tools/
│  │  ├─ getComponent.ts      # return markup + usage for a named component
│  │  ├─ listComponents.ts    # enumerate available components/blocks/patterns
│  │  ├─ getTokens.ts         # return design tokens (colours, spacing, type)
│  │  ├─ scaffoldUaePass.ts   # generate a compliant UAE Pass login block
│  │  └─ scaffoldEmiratesId.ts# generate a valid Emirates ID input
│  └─ rules/
│     └─ rules.md             # the non-negotiable standards (see §7)
└─ evals/
   └─ screens/                # the 10 test prompts + expected output
```

This is a starting shape, not a cage — adjust as the parsing reality demands, but keep the catalogue, tools, and rules cleanly separated.

## 6. Build order (do these in sequence)

1. **Scaffold the repo and toolchain.** Initialise Node + TypeScript, add the MCP SDK, get an empty server that an assistant can connect to and that responds to a trivial "ping" tool. Prove the connection works before anything else.
2. **Pull and inspect the design system.** Install `@aegov/design-system`. Open its files and confirm, against the live source, the current list of components, blocks, patterns, and where tokens live. **Do not assume the inventory from memory — read it from the installed package and the docs.**
3. **Write the catalogue parser.** Produce `catalog.json`: for each component, capture its name, the HTML (and React, if available) markup, the relevant class names, and a short usage note. This is the heart of Stage 1 and where most of the time goes; real-world data will be messier than expected.
4. **Expose the read tools.** `listComponents`, `getComponent`, `getTokens`. Verify an assistant can call them and get clean, usable data.
5. **Build the scaffolders.** `scaffoldUaePass` and `scaffoldEmiratesId` — the two highest-value, UAE-specific, easy-to-get-wrong pieces. These should emit correct, RTL-aware, bilingual-ready starting code.
6. **Write the rules file** (see §7) and ensure the server surfaces it so the assistant treats the rules as constraints.
7. **Run the evals.** Work through the ten screens until the exit test in §3 passes. Iterate on the catalogue and tool descriptions — not on hand-edited output.
8. **Write the README and publish.** Clear install steps for Cursor, Claude Code, and Copilot. Publish open source under MIT, matching the design system's own licence.

## 7. The rules file — non-negotiables to encode

These must be expressed clearly so a connected assistant respects them automatically:

- **Accessibility:** target **WCAG 2.2 Level AA**. (The legal baseline is 2.1 AA; build to 2.2 to be safe.)
- **UAE Pass:** any login must use the **UAE Pass** block — it is mandatory, not optional.
- **Emirates ID:** the input must follow the official format `784-NNNN-NNNNNNN-N`, with masking and pattern validation.
- **Bilingual + RTL:** Arabic and right-to-left are first-class. Components should default to supporting both, never English-only.
- **Tokens only:** use the design system's own colour, spacing, and type tokens — never arbitrary hard-coded values.
- **Components over custom:** prefer an official component/block/pattern over a hand-rolled one wherever one exists.

## 8. Guardrails and cautions

- **Verify versions live.** Both the design system (v3.x) and the MCP SDK move. At build time, check the actual installed versions and the current SDK API rather than trusting any version numbers written here.
- **Arabic quality is a known weak spot.** Flag anything Arabic-related for a native-speaker check; do not silently "improve" Arabic text.
- **Pin dependencies.** Lock the design system and SDK versions so the catalogue stays stable; bump them deliberately.
- **Stay open and clean.** This is a credibility play with a public-sector audience — readable code, good README, MIT licence.
- **Don't rebuild the regulator's chatbot.** This is a developer tool that returns runnable components and integrates into IDEs — not a Q&A chat experience.

## 9. First message to give Claude Code

> "Read `STAGE1-HANDOFF.md` in this repo. Then start with build step 1: scaffold a Node + TypeScript MCP server using the official MCP SDK, with a single trivial `ping` tool, so we can confirm an assistant can connect. Do not move past step 1 until the connection is proven. Check the current MCP SDK API from its official docs before writing the server."
