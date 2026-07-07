/**
 * End-to-end proof over real stdio, using the official MCP SDK *client* —
 * the same machinery AI assistants embed. Spawns the built server, completes
 * the initialize handshake, lists tools, and exercises ping plus the three
 * read tools (listComponents, getComponent, getTokens) including name
 * resolution, tier surfacing, and the unknown-name error path, plus the
 * step-5 tools (scaffoldUaePass, scaffoldEmiratesId, validate_snippet).
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

  const readTools = ["listComponents", "getComponent", "getTokens"];
  check(
    "tools/list exposes read tools",
    readTools.every((n) => tools.some((t) => t.name === n)),
    `tools: [${tools.map((t) => t.name).join(", ")}]`,
  );

  const call = async (name, args = {}) => {
    const res = await client.callTool({ name, arguments: args });
    return { res, body: JSON.parse(res.content?.[0]?.text ?? "null") };
  };

  const { body: list } = await call("listComponents");
  check(
    "listComponents shape",
    list.components?.length === 27 &&
      list.blocks?.length === 8 &&
      list.patterns?.length === 6 &&
      list.docsOnlyComponents?.length === 2,
    `27/8/6/2 expected, got ${list.components?.length}/${list.blocks?.length}/${list.patterns?.length}/${list.docsOnlyComponents?.length}`,
  );

  const { body: btn } = await call("getComponent", { name: "Button" });
  check(
    "getComponent resolves docs name 'Button' -> aegov-btn with markup + rules",
    btn.classRoot === "aegov-btn" &&
      btn.tier === "package" &&
      btn.markup?.html.includes("aegov-btn") &&
      btn.rules.length > 0 &&
      btn.docsSources?.[0]?.url.includes("designsystem.gov.ae"),
    `classRoot=${btn.classRoot}, rules=${btn.rules?.length}, examples=${btn.examples?.length}`,
  );

  const { body: chk } = await call("getComponent", { name: "checkbox" });
  check(
    "getComponent resolves 'checkbox' -> merged aegov-check root",
    chk.classRoot === "aegov-check" && chk.docsNames?.includes("Radio"),
    `classRoot=${chk.classRoot}, docsNames=${JSON.stringify(chk.docsNames)}`,
  );

  const { body: hdr } = await call("getComponent", { name: "header" });
  check(
    "getComponent resolves 'header' -> docs block carrying the markup",
    hdr.kind === "block" &&
      hdr.tier === "docs" &&
      hdr.markup?.html.includes("aegov-header") &&
      hdr.packageClassRoots?.includes("aegov-header"),
    `kind=${hdr.kind}, buildsOn=${JSON.stringify(hdr.packageClassRoots)}`,
  );

  const { body: eid } = await call("getComponent", { name: "Emirates ID" });
  check(
    "getComponent resolves 'Emirates ID' -> guidance-only pattern",
    eid.kind === "pattern" && eid.markup === null && eid.rules?.length >= 2,
    `kind=${eid.kind}, rules=${eid.rules?.length}`,
  );

  const { res: missRes, body: miss } = await call("getComponent", {
    name: "no-such-thing",
  });
  check(
    "getComponent unknown name -> isError with identifiers",
    missRes.isError === true && Array.isArray(miss.knownIdentifiers?.componentClassRoots),
    miss.error,
  );

  const { body: tok } = await call("getTokens", { category: "color", query: "primary" });
  check(
    "getTokens filters color/primary",
    tok.matched > 0 &&
      tok.tokens.every((t) => t.category === "color" && t.name.includes("primary")) &&
      tok.tier === "package",
    `matched=${tok.matched}, first=${tok.tokens?.[0]?.name}=${tok.tokens?.[0]?.value}`,
  );

  const step5Tools = ["scaffoldUaePass", "scaffoldEmiratesId", "validate_snippet"];
  check(
    "tools/list exposes step-5 tools",
    step5Tools.every((n) => tools.some((t) => t.name === n)),
    `tools: [${tools.map((t) => t.name).join(", ")}]`,
  );

  const { body: up } = await call("scaffoldUaePass", {});
  check(
    "scaffoldUaePass defaults: bilingual sign-in, black, staging",
    up.html?.en?.includes("aegov-btn") &&
      up.html.en.includes("Sign in with UAE PASS") &&
      up.html?.ar?.includes('dir="rtl"') &&
      up.arabicNote?.includes("GENERATED") &&
      up.oauth?.endpoints?.authorization === "https://stg-id.uaepass.ae/idshub/authorize" &&
      up.oauth?.authorizeUrlTemplate.includes("response_type=code") &&
      up.officialAssets?.files?.length > 0 &&
      up.rules?.length > 0 &&
      up.provenance?.guidance?.origin === "https://docs.uaepass.ae",
    `rules=${up.rules?.length}, assets=${up.officialAssets?.files?.length}`,
  );

  const { body: upProd } = await call("scaffoldUaePass", {
    variant: "continue",
    appearance: "white",
    language: "en",
    environment: "production",
  });
  check(
    "scaffoldUaePass continue/white/en/production",
    upProd.html?.en?.includes("Continue with UAE PASS") &&
      !upProd.html?.ar &&
      upProd.oauth?.endpoints?.authorization === "https://id.uaepass.ae/idshub/authorize" &&
      upProd.rules?.some((r) => r.topic === "Continue with UAE PASS") &&
      upProd.rules?.some((r) => r.topic === "White Button"),
    `topics=${JSON.stringify(upProd.rules?.slice(0, 3).map((r) => r.topic))}`,
  );

  const { body: eidS } = await call("scaffoldEmiratesId", {});
  check(
    "scaffoldEmiratesId defaults: bilingual, masked display",
    eidS.html?.includes("aegov-form-control") &&
      eidS.html.includes('pattern="^784-\\d{4}-\\d{7}-\\d$"') &&
      eidS.html.includes('dir="ltr"') &&
      eidS.js?.includes('replace(/\\D/g, "")') && // 15 raw digits, no dashes required
      eidS.maskedDisplay?.html?.includes("reveal") &&
      eidS.rules?.length >= 2 &&
      eidS.provenance?.guidance?.trust?.includes("HIGH-STAKES"),
    `rules=${eidS.rules?.length}`,
  );

  const { body: vOk } = await call("validate_snippet", {
    html: '<button class="aegov-btn btn-outline" type="button">Salam</button>',
  });
  check(
    "validate_snippet passes a valid DLS button",
    vOk.valid === true && vOk.classes?.packageVerified?.includes("aegov-btn"),
    vOk.summary,
  );

  const { body: vBad } = await call("validate_snippet", {
    html:
      '<div class="aegov-newslette aegov-btnn"><img src="x.png">' +
      '<input placeholder="784-XXXX-XXXXXXX-X"><span>784-1980-1234567-1</span></div>',
  });
  check(
    "validate_snippet flags docs-only class, unknown class, missing alt, unvalidated+unmasked EID",
    vBad.valid === false &&
      vBad.findings?.some((f) => f.message.includes("aegov-newslette")) &&
      vBad.findings?.some((f) => f.message.includes("aegov-btnn")) &&
      vBad.findings?.some((f) => f.message.includes("alt")) &&
      vBad.findings?.some((f) => f.message.includes("pattern validation")) &&
      vBad.findings?.some((f) => f.message.includes("masked")),
    vBad.summary,
  );

  const { body: vScaffold } = await call("validate_snippet", { html: eidS.html });
  check(
    "validate_snippet accepts scaffoldEmiratesId output",
    vScaffold.valid === true,
    vScaffold.summary + (vScaffold.valid ? "" : ` ${JSON.stringify(vScaffold.findings)}`),
  );
} catch (err) {
  check("connection", false, err instanceof Error ? err.message : String(err));
} finally {
  await client.close();
}

process.exit(failed ? 1 : 0);
