#!/usr/bin/env node
/**
 * @dlsforge/aegov-mcp — MCP server for the UAE Design System (AEGOV DLS).
 *
 * Serves the rules-core catalogue (catalog/catalog.json, generated from the
 * pinned @aegov/design-system package + a designsystem.gov.ae docs snapshot)
 * to AI coding assistants over stdio.
 *
 * stdout is the JSON-RPC channel — never write logs there; use stderr.
 */
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadCatalog, loadUaePass } from "@dlsforge/aegov-rules-core";
import { registerListComponents } from "./tools/listComponents.js";
import { registerGetComponent } from "./tools/getComponent.js";
import { registerGetTokens } from "./tools/getTokens.js";
import { registerScaffoldUaePass } from "./tools/scaffoldUaePass.js";
import { registerScaffoldEmiratesId } from "./tools/scaffoldEmiratesId.js";
import { registerValidateSnippet } from "./tools/validateSnippet.js";

const catalog = loadCatalog();
const uaePass = loadUaePass();

// Read from package.json rather than repeating the version here: a hardcoded
// string silently drifted to 0.1.1 while the package shipped 0.2.0, so every
// client saw the wrong version. dist/index.js sits one level under the package
// root, and npm always includes package.json in the tarball.
const { version: VERSION } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const server = new McpServer({
  name: "aegov-dls",
  version: VERSION,
});

server.registerTool(
  "ping",
  {
    title: "Ping",
    description:
      "Health check for the AEGOV DLS MCP server. Returns 'pong', echoing back an optional message. Use to confirm the server is connected.",
    inputSchema: {
      message: z.string().optional().describe("Optional message to echo back"),
    },
  },
  async ({ message }) => ({
    content: [
      {
        type: "text",
        text: message ? `pong: ${message}` : "pong",
      },
    ],
  }),
);

registerListComponents(server, catalog);
registerGetComponent(server, catalog);
registerGetTokens(server, catalog);
registerScaffoldUaePass(server, uaePass);
registerScaffoldEmiratesId(server, catalog);
registerValidateSnippet(server, catalog);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `aegov-dls MCP server running on stdio — catalogue ${catalog.meta.generatedFrom.package}@${catalog.meta.generatedFrom.version} (${catalog.components.length} components, ${catalog.tokens.length} tokens)`,
);
