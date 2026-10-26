import { z } from "zod";
import { ApiRequestError, type WarehouseApiClient } from "../api-client.js";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

// Structured output plus a JSON text copy, for clients that only read `content`.
export const ok = (output: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(output) }],
  structuredContent: output,
});

export const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

// Turns API problems into tool errors the model can read. Anything else is an
// unexpected bug: say so without leaking internals.
export const guard = async (run: () => Promise<ToolResult>): Promise<ToolResult> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return fail(error.message);
    }

    console.error("Unexpected tool failure:", error instanceof Error ? error.name : "unknown");
    return fail("Unexpected error while handling the request.");
  }
};

export const skuField = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("Exact product SKU, e.g. 'WIDGET-100'. Use search_items first if you only know part of it.");

export const locationIdField = z
  .uuid()
  .optional()
  .describe("Restrict to one storage location by its UUID (the locationId returned by other tools).");

export const stockStatusSchema = z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]);

// One inventory row (a product at a location), trimmed to what a model needs.
export const stockRowSchema = z.object({
  sku: z.string(),
  name: z.string(),
  locationId: z.string(),
  locationCode: z.string(),
  warehouseCode: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  damaged: z.number(),
  available: z.number(),
  status: stockStatusSchema,
  lastMovementAt: z.string().nullable(),
});

export type StockRow = z.infer<typeof stockRowSchema>;

type OverviewApiRow = {
  sku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
  status: StockRow["status"];
  lastMovementAt: string | null;
};

type OverviewResponse = {
  data: OverviewApiRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

const toStockRow = (row: OverviewApiRow): StockRow => ({
  sku: row.sku,
  name: row.productName,
  locationId: row.locationId,
  locationCode: row.locationCode,
  warehouseCode: row.warehouseCode,
  onHand: row.onHand,
  reserved: row.reserved,
  damaged: row.damaged,
  available: row.available,
  status: row.status,
  lastMovementAt: row.lastMovementAt,
});

export type OverviewParams = {
  search?: string;
  locationId?: string;
  status?: StockRow["status"];
  sortBy?: "product" | "sku" | "available";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export const fetchOverview = async (
  client: WarehouseApiClient,
  params: OverviewParams,
) => {
  const response = await client.get<OverviewResponse>("/api/inventory/overview", params);

  return {
    rows: response.data.map(toStockRow),
    total: response.meta.total,
    totalPages: response.meta.totalPages,
  };
};
