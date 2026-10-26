import { z } from "zod";

export const inventoryQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export const receiveStockSchema = z.object({
  productId: z.uuid(),
  locationId: z.uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export const reserveStockSchema = z.object({
  productId: z.uuid(),
  locationId: z.uuid(),
  quantity: z.number().int().positive(),
});

export const releaseStockSchema = z.object({
  productId: z.uuid(),
  locationId: z.uuid(),
  quantity: z.number().int().positive(),
});

export const inventoryMovementsQuerySchema = z.object({
  productId: z.uuid().optional(),
  locationId: z.uuid().optional(),
});

export const stockStatuses = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const;

export const inventoryOverviewSortKeys = [
  "product",
  "sku",
  "location",
  "onHand",
  "available",
  "status",
  "lastMovement",
] as const;

// Query-string values arrive as text, so numbers are coerced. An empty
// search box sends nothing useful, so "" is treated as "no search".
export const inventoryOverviewQuerySchema = z.object({
  locationId: z.uuid().optional(),
  status: z.enum(stockStatuses).optional(),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
  sortBy: z.enum(inventoryOverviewSortKeys).default("product"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const inventoryIdParamSchema = z.object({
  id: z.uuid(),
});

export const cycleCountFlagSchema = z.object({
  flagged: z.boolean(),
});

export type CycleCountFlagInput = z.infer<typeof cycleCountFlagSchema>;
export type StockStatus = (typeof stockStatuses)[number];
export type InventoryOverviewQuery = z.infer<typeof inventoryOverviewQuerySchema>;
export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;
export type ReserveStockInput = z.infer<typeof reserveStockSchema>;
export type ReleaseStockInput = z.infer<typeof releaseStockSchema>;
export type InventoryMovementsQuery = z.infer<typeof inventoryMovementsQuerySchema>;
