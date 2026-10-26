import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { WarehouseApiClient } from "../api-client.js";
import {
  fail,
  fetchOverview,
  guard,
  locationIdField,
  ok,
  skuField,
  stockRowSchema,
  type StockRow,
} from "./shared.js";

// The overview endpoint only does substring search, so an exact SKU may sit
// among other matches ("AB1" also matches "AB10"). Sorted by SKU, a few pages
// are always enough in practice; the cap keeps a vague SKU from scanning forever.
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

export const getStockLevelInput = z.object({
  sku: skuField,
  locationId: locationIdField,
});

export const getStockLevelOutput = z.object({
  sku: z.string(),
  name: z.string(),
  totals: z.object({
    onHand: z.number(),
    reserved: z.number(),
    damaged: z.number(),
    available: z.number(),
  }),
  locations: z.array(stockRowSchema),
});

export const getStockLevel = (
  client: WarehouseApiClient,
  input: z.infer<typeof getStockLevelInput>,
) =>
  guard(async () => {
    const wanted = input.sku.toLowerCase();
    const matches: StockRow[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await fetchOverview(client, {
        search: input.sku,
        locationId: input.locationId,
        sortBy: "sku",
        page,
        pageSize: PAGE_SIZE,
      });

      matches.push(...result.rows.filter((row) => row.sku.toLowerCase() === wanted));

      if (page >= result.totalPages) break;
    }

    const first = matches[0];

    if (!first) {
      return fail(
        `No stock found for SKU "${input.sku}"${input.locationId ? " at that location" : ""}. ` +
          "Use search_items to find the exact SKU.",
      );
    }

    const sum = (pick: (row: StockRow) => number) =>
      matches.reduce((total, row) => total + pick(row), 0);

    return ok({
      sku: first.sku,
      name: first.name,
      totals: {
        onHand: sum((row) => row.onHand),
        reserved: sum((row) => row.reserved),
        damaged: sum((row) => row.damaged),
        available: sum((row) => row.available),
      },
      locations: matches,
    });
  });

export const registerGetStockLevel = (server: McpServer, client: WarehouseApiClient) =>
  server.registerTool(
    "get_stock_level",
    {
      title: "Get stock level",
      description:
        "Current stock for one product, identified by its exact SKU: totals across locations plus one row per storage location. " +
        "available = onHand - reserved - damaged. Optionally limit to a single location with locationId. " +
        "If the SKU is not found, use search_items to look it up. Read-only.",
      inputSchema: getStockLevelInput,
      outputSchema: getStockLevelOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) => getStockLevel(client, input),
  );
