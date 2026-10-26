import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { WarehouseApiClient } from "../api-client.js";
import {
  fetchOverview,
  guard,
  locationIdField,
  ok,
  stockRowSchema,
  type StockRow,
} from "./shared.js";

// The API's own LOW_STOCK status is fixed at 1-10 available.
const API_LOW_STOCK_MAX = 10;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export const listLowStockInput = z.object({
  threshold: z
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(API_LOW_STOCK_MAX)
    .describe("Report rows whose available quantity is at or below this number (default 10)."),
  includeOutOfStock: z
    .boolean()
    .default(false)
    .describe("Also include rows with 0 or less available (default false)."),
  locationId: locationIdField,
  limit: z.number().int().min(1).max(100).default(50).describe("Maximum rows to return (1-100, default 50)."),
});

export const listLowStockOutput = z.object({
  threshold: z.number(),
  items: z.array(stockRowSchema),
  truncated: z.boolean().describe("True when there may be more matching rows than were returned."),
});

export const listLowStock = (
  client: WarehouseApiClient,
  input: z.infer<typeof listLowStockInput>,
) =>
  guard(async () => {
    // Without out-of-stock rows and within the API's own range, let the API
    // filter, so thousands of empty shelves are not paged through first.
    const status =
      !input.includeOutOfStock && input.threshold <= API_LOW_STOCK_MAX
        ? ("LOW_STOCK" as const)
        : undefined;
    const items: StockRow[] = [];
    let truncated = false;

    scan: for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await fetchOverview(client, {
        status,
        locationId: input.locationId,
        sortBy: "available",
        sortDir: "asc",
        page,
        pageSize: PAGE_SIZE,
      });

      for (const row of result.rows) {
        if (row.available > input.threshold) break scan; // sorted: nothing lower follows
        if (!input.includeOutOfStock && row.available <= 0) continue;

        if (items.length === input.limit) {
          truncated = true;
          break scan;
        }

        items.push(row);
      }

      if (page >= result.totalPages) break;
      if (page === MAX_PAGES) truncated = true;
    }

    return ok({ threshold: input.threshold, items, truncated });
  });

export const registerListLowStock = (server: McpServer, client: WarehouseApiClient) =>
  server.registerTool(
    "list_low_stock",
    {
      title: "List low stock",
      description:
        "List product/location rows that are running low: available quantity (onHand - reserved - damaged) at or below a threshold, " +
        "lowest first. Default threshold is 10 and rows with nothing available are left out unless includeOutOfStock is true. " +
        "Optionally limit to one location. Read-only.",
      inputSchema: listLowStockInput,
      outputSchema: listLowStockOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) => listLowStock(client, input),
  );
