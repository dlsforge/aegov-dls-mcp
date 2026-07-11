/**
 * Shared harness for the node:test suites: connects the official MCP SDK
 * client to a built server over real stdio (same machinery assistants embed).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Spawn `node <serverPath>` and connect. Returns { call, close }.
 * call(name, args) -> { res, body, error }:
 *   - body: parsed JSON payload of the first text content (or raw text)
 *   - error: message when the call was rejected at the protocol layer
 *     (schema violation) — distinct from an in-band `res.isError` result.
 */
export async function connectServer(serverPath = "dist/index.js", cwd = process.cwd()) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd,
    stderr: "pipe", // keep the startup banner out of the test output
  });
  const client = new Client({ name: "stage1-tests", version: "0.0.0" });
  await client.connect(transport);

  const call = async (name, args = {}) => {
    try {
      const res = await client.callTool({ name, arguments: args });
      const text = res.content?.[0]?.text ?? "null";
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      return { res, body, error: null };
    } catch (err) {
      return { res: null, body: null, error: err instanceof Error ? err.message : String(err) };
    }
  };

  return { client, call, close: () => client.close() };
}
