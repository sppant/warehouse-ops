import { z } from "zod";
import type { Operation } from "../../openapi/define.js";
import {
  badRequest,
  dataOf,
  listOf,
  notFound,
  timestampField,
  uuidField,
} from "../../openapi/common.js";
import { stockMovementType } from "../../db/schema.js";
import {
  cycleCountFlagSchema,
  inventoryIdParamSchema,
  inventoryMovementsQuerySchema,
  inventoryOverviewQuerySchema,
  inventoryQuerySchema,
  receiveStockSchema,
  stockStatuses,
} from "./inventory.schema.js";

const tag = "Inventory";

const counts = {
  onHand: z.number().int(),
  reserved: z.number().int(),
  damaged: z.number().int(),
  available: z.number().int().describe("onHand - reserved - damaged"),
};

const inventoryItem = z.object({
  id: uuidField,
  productId: uuidField,
  sku: z.string(),
  productName: z.string(),
  locationId: uuidField,
  locationCode: z.string(),
  locationName: z.string(),
  warehouseId: uuidField,
  warehouseCode: z.string(),
  warehouseName: z.string(),
  ...counts,
  updatedAt: timestampField,
});

const overviewRow = z.object({
  id: uuidField,
  productId: uuidField,
  sku: z.string(),
  productName: z.string(),
  locationId: uuidField,
  locationCode: z.string(),
  warehouseCode: z.string(),
  ...counts,
  status: z.enum(stockStatuses),
  lastMovementAt: timestampField.nullable(),
  cycleCountFlaggedAt: timestampField.nullable(),
});

const overviewPage = z.object({
  data: z.array(overviewRow),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

const summary = z.object({
  stockByLocation: z.array(
    z.object({
      locationId: uuidField,
      locationCode: z.string(),
      warehouseCode: z.string(),
      onHand: z.number().int(),
      available: z.number().int(),
    }),
  ),
  movementsPerDay: z.array(
    z.object({
      date: z.string().meta({ format: "date" }),
      count: z.number().int(),
      volume: z.number().int(),
    }),
  ),
  topItems: z.array(
    z.object({
      productId: uuidField,
      sku: z.string(),
      productName: z.string(),
      movementCount: z.number().int(),
      volume: z.number().int(),
    }),
  ),
});

const movement = z.object({
  id: uuidField,
  productId: uuidField,
  sku: z.string(),
  productName: z.string(),
  locationId: uuidField,
  locationCode: z.string(),
  type: z.enum(stockMovementType.enumValues),
  quantity: z.number().int().describe("Unsigned, except ADJUSTMENT which can be negative."),
  referenceType: z.string().nullable(),
  referenceId: uuidField.nullable(),
  reason: z.string().nullable(),
  createdAt: timestampField,
});

const inventoryRow = z.object({
  id: uuidField,
  productId: uuidField,
  locationId: uuidField,
  onHand: z.number().int(),
  reserved: z.number().int(),
  damaged: z.number().int(),
  cycleCountFlaggedAt: timestampField.nullable(),
  updatedAt: timestampField,
});

export const inventoryOperations: Operation[] = [
  {
    method: "get",
    path: "/api/inventory",
    tag,
    summary: "List inventory rows",
    description: "One row per product and location, sorted by product name. Optional search matches SKU, name or location code.",
    query: inventoryQuerySchema,
    responses: {
      200: { description: "Inventory rows", schema: listOf(inventoryItem) },
      400: badRequest("Invalid query"),
    },
  },
  {
    method: "get",
    path: "/api/inventory/overview",
    tag,
    summary: "Paged inventory overview",
    description: "Filtering, sorting and pagination happen on the server. Status: OUT_OF_STOCK when available <= 0, LOW_STOCK when 1-10, otherwise IN_STOCK.",
    query: inventoryOverviewQuerySchema,
    responses: {
      200: { description: "One page of rows with paging metadata", schema: overviewPage },
      400: badRequest("Invalid query"),
    },
  },
  {
    method: "get",
    path: "/api/inventory/summary",
    tag,
    summary: "Chart data for the inventory overview",
    description: "Stock by location (top 20), movements per day for the last 30 UTC days, and the top 10 items by units moved.",
    responses: { 200: { description: "Summary aggregates", schema: dataOf(summary) } },
  },
  {
    method: "get",
    path: "/api/inventory/movements",
    tag,
    summary: "List stock movements",
    description: "Newest first. Without filters this is the whole history.",
    query: inventoryMovementsQuerySchema,
    responses: {
      200: { description: "Stock movements", schema: listOf(movement) },
      400: badRequest("Invalid query"),
    },
  },
  {
    method: "put",
    path: "/api/inventory/{id}/cycle-count-flag",
    tag,
    summary: "Flag or unflag an inventory row for recounting",
    description: "Idempotent. Never changes stock and never writes a stock movement.",
    params: inventoryIdParamSchema,
    body: cycleCountFlagSchema,
    responses: {
      200: {
        description: "The row's flag state",
        schema: dataOf(z.object({ id: uuidField, cycleCountFlaggedAt: timestampField.nullable() })),
      },
      400: badRequest("Invalid id or body"),
      404: notFound("No inventory row with this id"),
    },
  },
  {
    method: "post",
    path: "/api/inventory/receive",
    tag,
    summary: "Receive stock into a location",
    description: "Adds to on-hand and writes a RECEIPT movement.",
    body: receiveStockSchema,
    responses: {
      201: { description: "The updated inventory row", schema: dataOf(inventoryRow) },
      400: badRequest("Invalid receiving data"),
      404: notFound("Product or location not found"),
    },
  },
];
