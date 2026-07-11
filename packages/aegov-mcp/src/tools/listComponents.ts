/**
 * listComponents — enumerate everything the catalogue knows, with enough
 * metadata for an assistant to pick the right follow-up getComponent call.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Catalog } from "@dlsforge/aegov-rules-core";
import { DOCS_TRUST, json } from "./shared.js";

export function registerListComponents(server: McpServer, catalog: Catalog): void {
  server.registerTool(
    "listComponents",
    {
      title: "List UAE Design System components",
      description:
        "List every artifact of the UAE Design System (AEGOV DLS) this server can describe: " +
        "package components (authoritative classes + official markup), blocks, patterns, and " +
        "docs-only components. Call this first to discover what exists and the exact identifier " +
        "to pass to getComponent. Package-tier data is authoritative for the pinned " +
        "@aegov/design-system version; docs-tier data comes from designsystem.gov.ae and is " +
        "provisional. When building a full page, note the standard page furniture: every UAE " +
        "government page carries the header block, the footer block, and the page-rating block " +
        "('Did you find this content useful?') near the end of the page content.",
      inputSchema: {},
    },
    async () =>
      json({
        package: `${catalog.meta.generatedFrom.package}@${catalog.meta.generatedFrom.version}`,
        components: catalog.components.map((c) => ({
          classRoot: c.classRoot,
          docsNames: c.docsNames,
          tier: "package",
          hasMarkup: c.markup !== null,
          rules: c.rules.length,
          ...(c.taxonomyNote ? { taxonomyNote: c.taxonomyNote } : {}),
        })),
        blocks: catalog.blocks.map((b) => ({
          id: b.id,
          name: b.name,
          tier: "docs",
          hasMarkup: b.markup !== null,
          buildsOn: b.packageClassRoots,
        })),
        patterns: catalog.patterns.map((p) => ({
          id: p.id,
          name: p.name,
          tier: "docs",
          guidanceOnly: p.markup === null,
        })),
        docsOnlyComponents: catalog.docsOnlyComponents.map((d) => ({
          id: d.id,
          name: d.name,
          tier: "docs",
          buildsOn: d.packageClassRoots,
        })),
        notes: [
          `docs-tier records are ${DOCS_TRUST}`,
          "Use getComponent with any classRoot, docs name, block/pattern id, or member class to get markup, variant examples and rules.",
          "Standard page furniture: every UAE government page carries the 'header' block, the 'footer' block, and the 'page-rating' block ('Did you find this content useful?') near the end of the page content — include all three when composing a full page.",
        ],
      }),
  );
}
