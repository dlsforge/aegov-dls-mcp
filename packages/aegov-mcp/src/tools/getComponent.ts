/**
 * getComponent — full record for one artifact: official markup, variant
 * examples, rules (accessibility / RTL / usage), classes and provenance.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Catalog } from "@dlsforge/aegov-rules-core";
import {
  artifactView,
  buildIndex,
  componentView,
  json,
  jsonError,
  knownIdentifiers,
  normalizeKey,
} from "./shared.js";

export function registerGetComponent(server: McpServer, catalog: Catalog): void {
  const index = buildIndex(catalog);

  server.registerTool(
    "getComponent",
    {
      title: "Get a UAE Design System component",
      description:
        "Return the full official record for one UAE Design System (AEGOV DLS) artifact: " +
        "canonical markup, variant examples (copy these rather than inventing markup), rules " +
        "(accessibility, RTL/bilingual, usage), class inventory and provenance. Accepts a " +
        "component class-root ('aegov-btn'), a docs name ('Button', 'Checkbox'), a block or " +
        "pattern id ('header', 'emirates-id-input'), or any member class ('aegov-check-item'). " +
        "Use listComponents to discover identifiers. Always respect the returned rules; markup " +
        "must keep the official aegov-* classes.",
      inputSchema: {
        name: z
          .string()
          .describe(
            "Component class-root, docs name, block/pattern id, or member class (case-insensitive)",
          ),
      },
    },
    async ({ name }) => {
      const hit = index.get(normalizeKey(name));
      if (!hit) {
        const ids = knownIdentifiers(catalog);
        const key = normalizeKey(name);
        const near = [...index.keys()].filter(
          (k) => k.includes(key) || key.includes(k),
        );
        return jsonError({
          error: `No catalogue entry matches '${name}'.`,
          ...(near.length ? { didYouMean: near.slice(0, 8) } : {}),
          knownIdentifiers: ids,
          hint: "Call listComponents for names and metadata.",
        });
      }
      return json(
        hit.kind === "component"
          ? componentView(catalog, hit.record)
          : artifactView(catalog, hit.record),
      );
    },
  );
}
