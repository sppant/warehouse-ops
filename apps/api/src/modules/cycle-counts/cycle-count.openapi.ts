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
import { cycleCountStatus } from "../../db/schema.js";
import { cycleCountIdSchema, recordCycleCountSchema } from "./cycle-count.schema.js";

const tag = "Cycle counts";

const counts = {
  expectedQuantity: z.number().int(),
  countedQuantity: z.number().int(),
  difference: z.number().int().describe("countedQuantity - expectedQuantity"),
  reason: z.string().nullable(),
  status: z.enum(cycleCountStatus.enumValues),
  createdAt: timestampField,
  reviewedAt: timestampField.nullable(),
};

// GET joins the product and location for sku, productName and locationCode.
const cycleCount = z.object({
  id: uuidField,
  productId: uuidField,
  sku: z.string(),
  productName: z.string(),
  locationId: uuidField,
  locationCode: z.string(),
  ...counts,
});

// POST, approve and reject return the row as stored, without the joined names.
const storedCycleCount = z.object({
  id: uuidField,
  productId: uuidField,
  locationId: uuidField,
  ...counts,
});

const review = (action: "approve" | "reject", summary: string, description: string): Operation => ({
  method: "post",
  path: `/api/cycle-counts/{id}/${action}`,
  tag,
  summary,
  description,
  params: cycleCountIdSchema,
  responses: {
    200: { description: "The reviewed cycle count", schema: dataOf(storedCycleCount) },
    400: badRequest("Invalid id, or the count is not PENDING"),
    404: notFound("No cycle count with this id"),
  },
});

export const cycleCountOperations: Operation[] = [
  {
    method: "get",
    path: "/api/cycle-counts",
    tag,
    summary: "List cycle counts",
    description: "Newest first.",
    responses: { 200: { description: "Cycle counts", schema: listOf(cycleCount) } },
  },
  {
    method: "get",
    path: "/api/cycle-counts/{id}",
    tag,
    summary: "Get a cycle count",
    params: cycleCountIdSchema,
    responses: {
      200: { description: "The cycle count", schema: dataOf(cycleCount) },
      400: badRequest("The id is not a UUID"),
      404: notFound("No cycle count with this id"),
    },
  },
  {
    method: "post",
    path: "/api/cycle-counts",
    tag,
    summary: "Record a physical count",
    description: "Stores the count as PENDING with the on-hand quantity at the time as expectedQuantity. Stock is unchanged until it is approved.",
    body: recordCycleCountSchema,
    responses: {
      201: { description: "The recorded count", schema: dataOf(storedCycleCount) },
      400: badRequest("Invalid cycle count data"),
      404: notFound("Product or location not found"),
    },
  },
  review(
    "approve",
    "Approve a pending count",
    "Posts an ADJUSTMENT movement and updates on-hand by the difference.",
  ),
  review("reject", "Reject a pending count", "Leaves stock unchanged."),
];
