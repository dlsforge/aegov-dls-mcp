/**
 * getTokens — resolved design tokens from the pinned package. These are the
 * ONLY values generated UI should use for colour/type/shadow/container sizing.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Catalog, TokenCategory } from "@dlsforge/aegov-rules-core";
import { json } from "./shared.js";

const CATEGORIES = [
  "color",
  "typography",
  "font",
  "spacing",
  "shadow",
  "container",
  "other",
] as const satisfies readonly TokenCategory[];

export function registerGetTokens(server: McpServer, catalog: Catalog): void {
  const counts = catalog.tokens.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1;
    return acc;
  }, {});

  server.registerTool(
    "getTokens",
    {
      title: "Get UAE Design System design tokens",
      description:
        "Return the UAE Design System's resolved design tokens (CSS custom properties) from the " +
        "pinned @aegov/design-system package: colours (OKLCH palettes incl. semantic " +
        "primary/secondary), typography scale, fonts, shadows and container widths. Generated " +
        "markup must use these tokens or the aegov-* component classes built on them — never " +
        "arbitrary hard-coded values. Filter by category and/or a name substring " +
        "(e.g. category 'color', query 'primary').",
      inputSchema: {
        category: z
          .enum(CATEGORIES)
          .optional()
          .describe("Token category to filter by"),
        query: z
          .string()
          .optional()
          .describe("Case-insensitive substring of the token name, e.g. 'primary'"),
      },
    },
    async ({ category, query }) => {
      const q = query?.toLowerCase();
      const tokens = catalog.tokens.filter(
        (t) =>
          (!category || t.category === category) &&
          (!q || t.name.toLowerCase().includes(q)),
      );
      return json({
        package: `${catalog.meta.generatedFrom.package}@${catalog.meta.generatedFrom.version}`,
        tier: "package",
        note: "authoritative for the pinned version; values are resolved as the Tailwind plugin emits them",
        totalByCategory: counts,
        matched: tokens.length,
        tokens: tokens.map((t) => ({
          name: t.name,
          value: t.value,
          category: t.category,
        })),
      });
    },
  );
}
