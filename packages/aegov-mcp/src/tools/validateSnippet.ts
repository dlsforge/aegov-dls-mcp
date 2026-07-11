/**
 * validate_snippet — check an HTML snippet against the AEGOV DLS catalogue.
 *
 * The checks themselves live in @dlsforge/aegov-rules-core (the shared DLS
 * rule engine — same rules Mizan, the auditor, enforces); this file is only
 * the MCP wrapper: tool registration, input schema, and response shaping.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  type Catalog,
  EID_PATTERN,
  buildClassIndex,
  validateHtml,
} from "@dlsforge/aegov-rules-core";
import { json } from "./shared.js";

export function registerValidateSnippet(server: McpServer, catalog: Catalog): void {
  const index = buildClassIndex(catalog);

  server.registerTool(
    "validate_snippet",
    {
      title: "Validate an HTML snippet against the UAE Design System",
      description:
        "Validate generated HTML against the AEGOV DLS: verifies every aegov-* class against the " +
        "pinned @aegov/design-system version (certain), checks other classes against official " +
        "docs-example usage (best-effort), and runs UAE-specific checks — Emirates ID inputs must " +
        "validate " + EID_PATTERN + " and displayed IDs must be masked, images need alt, " +
        "Arabic content needs RTL handling, dates must be DMY (day/month/year, never " +
        "month-first). Call this on every snippet you emit before showing it to the user; fix " +
        "errors and re-validate.",
      inputSchema: {
        html: z.string().min(1).describe("The HTML snippet to validate"),
      },
    },
    async ({ html }) => {
      const { findings, classes } = validateHtml(html, index);
      const errors = findings.filter((f) => f.level === "error").length;
      return json({
        valid: errors === 0,
        summary:
          `${errors} error(s), ${findings.filter((f) => f.level === "warning").length} warning(s); ` +
          `${classes.packageVerified.length} package-verified class(es).`,
        findings,
        classes: {
          packageVerified: classes.packageVerified.sort(),
          seenInDocsExamples: classes.seenInDocsExamples.sort(),
          unverified: classes.unverified.sort(),
        },
        checkedAgainst: index.packageRef,
        note:
          "Class identity is package-verified (certain). Structural and UAE-specific checks are " +
          "best-effort heuristics — passing them does not guarantee full standard compliance.",
      });
    },
  );
}
