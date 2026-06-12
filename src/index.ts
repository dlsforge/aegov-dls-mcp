#!/usr/bin/env node
/**
 * @dlsforge/aegov-mcp — MCP server for the UAE Design System (AEGOV DLS).
 *
 * Stage 1, step 1: a single trivial `ping` tool to prove an AI assistant
 * can connect over stdio before any catalogue work begins.
 *
 * stdout is the JSON-RPC channel — never write logs there; use stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "aegov-dls",
  version: "0.1.0",
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("aegov-dls MCP server running on stdio");
