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
import {
  createPurchaseOrderSchema,
  purchaseOrderIdSchema,
  purchaseOrderStatus,
  receivePurchaseOrderItemSchema,
  updatePurchaseOrderStatusSchema,
} from "./purchase-order.schema.js";

const tag = "Purchase orders";

const purchaseOrder = z.object({
  id: uuidField,
  orderNumber: z.string(),
  supplier: z.string(),
  status: purchaseOrderStatus,
  orderedAt: timestampField.nullable(),
  expectedAt: timestampField.nullable(),
  createdAt: timestampField,
});

const money = z.string().describe("Decimal with 2 places, e.g. \"12.50\".");

// GET /:id joins the product, so its lines carry sku and productName.
const detailedItem = z.object({
  id: uuidField,
  productId: uuidField,
  sku: z.string(),
  productName: z.string(),
  orderedQuantity: z.number().int(),
  receivedQuantity: z.number().int(),
  unitCost: money,
});

// POST returns the rows as inserted.
const createdItem = z.object({
  id: uuidField,
  purchaseOrderId: uuidField,
  productId: uuidField,
  orderedQuantity: z.number().int(),
  receivedQuantity: z.number().int(),
  unitCost: money,
  createdAt: timestampField,
});

const receipt = z.object({
  purchaseOrderId: uuidField,
  purchaseOrderItemId: uuidField,
  productId: uuidField,
  locationId: uuidField,
  quantity: z.number().int(),
  status: purchaseOrderStatus.describe("The order's status after this receipt."),
});

// The route does not validate itemId: a value that is not a UUID reaches
// Postgres and the API answers 500 (not documented). Documented as a UUID.
const itemIdParam = z.object({ itemId: uuidField });

export const purchaseOrderOperations: Operation[] = [
  {
    method: "get",
    path: "/api/purchase-orders",
    tag,
    summary: "List purchase orders",
    description: "Newest first.",
    responses: { 200: { description: "Purchase orders", schema: listOf(purchaseOrder) } },
  },
  {
    method: "get",
    path: "/api/purchase-orders/{id}",
    tag,
    summary: "Get a purchase order with its lines",
    params: purchaseOrderIdSchema,
    responses: {
      200: {
        description: "The order and its lines",
        schema: dataOf(purchaseOrder.extend({ items: z.array(detailedItem) })),
      },
      400: badRequest("The id is not a UUID"),
      404: notFound("No purchase order with this id"),
    },
  },
  {
    method: "post",
    path: "/api/purchase-orders",
    tag,
    summary: "Create a purchase order",
    body: createPurchaseOrderSchema,
    responses: {
      201: {
        description: "The created order and its lines",
        schema: dataOf(purchaseOrder.extend({ items: z.array(createdItem) })),
      },
      400: badRequest("Invalid purchase order data"),
      404: notFound("A product on the order does not exist"),
      409: conflict("An order with this number already exists"),
    },
  },
  {
    method: "patch",
    path: "/api/purchase-orders/{id}/status",
    tag,
    summary: "Change a purchase order's status",
    params: purchaseOrderIdSchema,
    body: updatePurchaseOrderStatusSchema,
    responses: {
      200: { description: "The updated order", schema: dataOf(purchaseOrder) },
      400: badRequest("Invalid id or status"),
      404: notFound("No purchase order with this id"),
    },
  },
  {
    method: "post",
    path: "/api/purchase-orders/items/{itemId}/receive",
    tag,
    summary: "Receive stock against a purchase order line",
    description:
      "Adds to on-hand at the location, writes a RECEIPT movement and moves the order to PARTIALLY_RECEIVED or RECEIVED. 400 also covers a cancelled order, an unknown location and receiving more than ordered.",
    params: itemIdParam,
    body: receivePurchaseOrderItemSchema,
    responses: {
      201: { description: "What was received", schema: dataOf(receipt) },
      400: badRequest("Invalid data, or the receipt is not allowed"),
      404: notFound("No purchase order line with this id"),
    },
  },
];
