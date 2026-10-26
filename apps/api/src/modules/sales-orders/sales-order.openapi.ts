import { z } from "zod";
import type { Operation } from "../../openapi/define.js";
import {
  badRequest,
  conflict,
  dataOf,
  listOf,
  notFound,
  timestampField,
  uuidField,
} from "../../openapi/common.js";
import { salesOrderStatus } from "../../db/schema.js";
import { createSalesOrderSchema, salesOrderIdSchema } from "./sales-order.schema.js";

const tag = "Sales orders";

const salesOrder = z.object({
  id: uuidField,
  orderNumber: z.string(),
  customer: z.string(),
  status: z.enum(salesOrderStatus.enumValues),
  createdAt: timestampField,
});

const quantities = {
  orderedQuantity: z.number().int(),
  allocatedQuantity: z.number().int(),
  pickedQuantity: z.number().int(),
  shippedQuantity: z.number().int(),
};

// GET /:id joins the product, so its lines carry sku and productName.
const detailedItem = z.object({
  id: uuidField,
  productId: uuidField,
  sku: z.string(),
  productName: z.string(),
  ...quantities,
});

// POST returns the rows as inserted.
const createdItem = z.object({
  id: uuidField,
  salesOrderId: uuidField,
  productId: uuidField,
  ...quantities,
  createdAt: timestampField,
});

const transition = (path: string, summary: string, description: string): Operation => ({
  method: "post",
  path,
  tag,
  summary,
  description,
  params: salesOrderIdSchema,
  responses: {
    200: { description: "The updated order", schema: dataOf(salesOrder) },
    400: badRequest("Invalid id, or the order is not in a state that allows this"),
    404: notFound("No sales order with this id"),
  },
});

export const salesOrderOperations: Operation[] = [
  {
    method: "get",
    path: "/api/sales-orders",
    tag,
    summary: "List sales orders",
    description: "Newest first.",
    responses: { 200: { description: "Sales orders", schema: listOf(salesOrder) } },
  },
  {
    method: "get",
    path: "/api/sales-orders/{id}",
    tag,
    summary: "Get a sales order with its lines",
    params: salesOrderIdSchema,
    responses: {
      200: {
        description: "The order and its lines",
        schema: dataOf(salesOrder.extend({ items: z.array(detailedItem) })),
      },
      400: badRequest("The id is not a UUID"),
      404: notFound("No sales order with this id"),
    },
  },
  {
    method: "post",
    path: "/api/sales-orders",
    tag,
    summary: "Create a sales order",
    body: createSalesOrderSchema,
    responses: {
      201: {
        description: "The created order and its lines",
        schema: dataOf(salesOrder.extend({ items: z.array(createdItem) })),
      },
      400: badRequest("Invalid sales order data"),
      404: notFound("A product on the order does not exist"),
      409: conflict("An order with this number already exists"),
    },
  },
  transition(
    "/api/sales-orders/{id}/allocate",
    "Allocate stock to a pending order",
    "PENDING to ALLOCATED. Reserves stock; 400 if there is not enough available.",
  ),
  transition(
    "/api/sales-orders/{id}/pack",
    "Pack a fully picked order",
    "PICKED to PACKED.",
  ),
  transition(
    "/api/sales-orders/{id}/ship",
    "Ship a packed order",
    "PACKED to SHIPPED.",
  ),
];
