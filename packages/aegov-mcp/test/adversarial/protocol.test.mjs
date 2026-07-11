/**
 * Adversarial pass — JSON-RPC transport behaviour the Stage-1 suite doesn't reach:
 * interleaved concurrent calls, pipelined requests in one stdin chunk, garbage
 * frames, JSON-RPC batch arrays, and requests before initialize.
 *
 * Run: npm run build && node --test test/adversarial/protocol.test.mjs
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { connectServer } from "../helpers/mcp.mjs";

// --- interleaving through the official SDK (many in-flight calls at once) --------

describe("interleaved concurrent calls (SDK client)", () => {
  let srv;
  before(async () => {
    srv = await connectServer();
  });
  after(async () => {
    await srv.close();
  });

  test("40 concurrent pings each get THEIR OWN echo back (no response cross-wiring)", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => srv.call("ping", { message: `probe-${i}` })),
    );
    results.forEach((r, i) => assert.equal(r.body, `pong: probe-${i}`));
  });

  test("mixed tool calls in flight together all resolve correctly", async () => {
    const [btn, tokens, eid, bad, pong] = await Promise.all([
      srv.call("getComponent", { name: "aegov-btn" }),
      srv.call("getTokens", { category: "color", query: "primary" }),
      srv.call("scaffoldEmiratesId", { language: "en" }),
      srv.call("getComponent", { name: "definitely-not-a-component" }),
      srv.call("ping", { message: "mixed" }),
    ]);
    assert.equal(btn.body.classRoot, "aegov-btn");
    assert.ok(tokens.body.matched > 0);
    assert.ok(eid.body.html.includes("aegov-form-control"));
    assert.equal(bad.res.isError, true);
    assert.equal(pong.body, "pong: mixed");
  });
});

// --- raw stdio framing (below the SDK client) -------------------------------------

function rawServer() {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const messages = [];
  const waiters = [];
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        messages.push(JSON.parse(line));
      } catch {
        messages.push({ unparseable: line });
      }
      for (const w of waiters.splice(0)) w();
    }
  });
  const waitFor = (pred, ms = 5000) =>
    new Promise((resolve, reject) => {
      const t0 = Date.now();
      const check = () => {
        const hit = messages.find(pred);
        if (hit) return resolve(hit);
        if (Date.now() - t0 > ms) return reject(new Error(`timeout; got: ${JSON.stringify(messages)}`));
        waiters.push(check);
        setTimeout(check, 50);
      };
      check();
    });
  const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");
  const sendRaw = (s) => child.stdin.write(s);
  return { child, send, sendRaw, waitFor, messages };
}

const INIT = (id) => ({
  jsonrpc: "2.0",
  id,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "raw-adversary", version: "0.0.0" },
  },
});
const CALL = (id, name, args) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: args },
});

describe("raw stdio framing", () => {
  test("three pipelined tools/call requests written in ONE chunk all answer, ids matched", async () => {
    const s = rawServer();
    try {
      s.send(INIT(1));
      await s.waitFor((m) => m.id === 1 && m.result);
      // initialized notification + 3 calls, concatenated into a single write:
      s.sendRaw(
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" +
        JSON.stringify(CALL(2, "ping", { message: "first" })) + "\n" +
        JSON.stringify(CALL(3, "ping", { message: "second" })) + "\n" +
        JSON.stringify(CALL(4, "getTokens", { category: "color", query: "primary" })) + "\n",
      );
      const [r2, r3, r4] = await Promise.all([
        s.waitFor((m) => m.id === 2),
        s.waitFor((m) => m.id === 3),
        s.waitFor((m) => m.id === 4),
      ]);
      assert.equal(r2.result.content[0].text, "pong: first");
      assert.equal(r3.result.content[0].text, "pong: second");
      assert.ok(JSON.parse(r4.result.content[0].text).matched > 0);
    } finally {
      s.child.kill();
    }
  });

  test("a garbage (non-JSON) line does not kill the server; next call still answers", async () => {
    const s = rawServer();
    try {
      s.send(INIT(1));
      await s.waitFor((m) => m.id === 1 && m.result);
      s.send({ jsonrpc: "2.0", method: "notifications/initialized" });
      s.sendRaw("this is not json at all\n");
      s.send(CALL(2, "ping", { message: "after-garbage" }));
      const r = await s.waitFor((m) => m.id === 2);
      assert.equal(r.result.content[0].text, "pong: after-garbage");
      assert.equal(s.child.exitCode, null, "server process must still be alive");
    } finally {
      s.child.kill();
    }
  });

  test("a JSON-RPC batch array does not kill the server; next call still answers", async () => {
    const s = rawServer();
    try {
      s.send(INIT(1));
      await s.waitFor((m) => m.id === 1 && m.result);
      s.send({ jsonrpc: "2.0", method: "notifications/initialized" });
      s.send([CALL(2, "ping", { message: "batched-a" }), CALL(3, "ping", { message: "batched-b" })]);
      s.send(CALL(4, "ping", { message: "after-batch" }));
      const r = await s.waitFor((m) => m.id === 4);
      assert.equal(r.result.content[0].text, "pong: after-batch");
      assert.equal(s.child.exitCode, null, "server process must still be alive");
    } finally {
      s.child.kill();
    }
  });

  test("tools/call BEFORE initialize gets an error response (or is ignored), never a crash", async () => {
    const s = rawServer();
    try {
      s.send(CALL(99, "ping", { message: "too-early" }));
      // Whatever the SDK does with the early call, the handshake must still work:
      s.send(INIT(1));
      await s.waitFor((m) => m.id === 1 && m.result);
      s.send({ jsonrpc: "2.0", method: "notifications/initialized" });
      s.send(CALL(2, "ping", {}));
      const r = await s.waitFor((m) => m.id === 2);
      assert.equal(r.result.content[0].text, "pong");
      assert.equal(s.child.exitCode, null, "server process must still be alive");
    } finally {
      s.child.kill();
    }
  });
});
