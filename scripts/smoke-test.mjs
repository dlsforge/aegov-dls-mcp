/**
 * Connection proof for Stage 1, step 1.
 *
 * Uses the official MCP SDK *client* — the same machinery AI assistants
 * embed — to spawn the built server over stdio, complete the initialize
 * handshake, list tools, and call `ping`. If all three succeed, an
 * assistant can connect.
 *
 * Run: npm run build && npm run smoke
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath, // node
  args: ["dist/index.js"],
});

const client = new Client({ name: "smoke-test-client", version: "0.0.1" });

let failed = false;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
};

try {
  await client.connect(transport);
  const serverInfo = client.getServerVersion();
  check(
    "initialize handshake",
    serverInfo?.name === "aegov-dls",
    `server reported ${serverInfo?.name}@${serverInfo?.version}`,
  );

  const { tools } = await client.listTools();
  const ping = tools.find((t) => t.name === "ping");
  check(
    "tools/list exposes ping",
    Boolean(ping),
    `tools: [${tools.map((t) => t.name).join(", ")}]`,
  );

  const bare = await client.callTool({ name: "ping", arguments: {} });
  check(
    "tools/call ping ()",
    bare.content?.[0]?.text === "pong",
    `got ${JSON.stringify(bare.content)}`,
  );

  const echoed = await client.callTool({
    name: "ping",
    arguments: { message: "salam" },
  });
  check(
    "tools/call ping (echo)",
    echoed.content?.[0]?.text === "pong: salam",
    `got ${JSON.stringify(echoed.content)}`,
  );
} catch (err) {
  check("connection", false, err instanceof Error ? err.message : String(err));
} finally {
  await client.close();
}

process.exit(failed ? 1 : 0);
