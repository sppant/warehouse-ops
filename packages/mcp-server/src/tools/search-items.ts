import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { WarehouseApiClient } from "../api-client.js";
import {
  fetchOverview,
  guard,
  locationIdField,
  ok,
  stockRowSchema,
} from "./shared.js";

export const searchItemsInput = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("Text to look for in the product SKU, product name or location code (case-insensitive, partial match)."),
  locationId: locationIdField,
  limit: z.number().int().min(1).max(50).default(20).describe("Maximum rows to return (1-50, default 20)."),
});

export const searchItemsOutput = z.object({
  items: z.array(stockRowSchema),
  total: z.number().describe("How many rows match in total, which can exceed the rows returned."),
  truncated: z.boolean().describe("True when more rows match than were returned."),
});

export const searchItems = (
  client: WarehouseApiClient,
  input: z.infer<typeof searchItemsInput>,
) =>
  guard(async () => {
    const { rows, total } = await fetchOverview(client, {
      search: input.query,
      locationId: input.locationId,
      sortBy: "product",
      pageSize: input.limit,
    });

    return ok({ items: rows, total, truncated: total > rows.length });
  });

export const registerSearchItems = (server: McpServer, client: WarehouseApiClient) =>
  server.registerTool(
    "search_items",
    {
      title: "Search items",
      description:
        "Find warehouse items by text. Matches part of a product SKU, product name or location code. " +
        "Returns one row per product per storage location with on-hand, reserved, damaged and available quantities and a stock status " +
        "(IN_STOCK, LOW_STOCK = 1-10 available, OUT_OF_STOCK = 0 or less available). " +
        "Use this to discover SKUs and locationIds before calling other tools. Read-only.",
      inputSchema: searchItemsInput,
      outputSchema: searchItemsOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) => searchItems(client, input),
  );
