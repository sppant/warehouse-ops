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
import { pickTaskStatus } from "../../db/schema.js";
import {
  generatePickTaskSchema,
  pickItemSchema,
  pickTaskIdSchema,
  pickTaskItemIdSchema,
} from "./pick-task.schema.js";

const tag = "Picking";

const status = z.enum(pickTaskStatus.enumValues);

// List and detail join the sales order for its number and customer.
const pickTask = z.object({
  id: uuidField,
  salesOrderId: uuidField,
  orderNumber: z.string(),
  customer: z.string(),
  status,
  createdAt: timestampField,
  completedAt: timestampField.nullable(),
});

const pickTaskItem = z.object({
  id: uuidField,
  salesOrderItemId: uuidField,
  productId: uuidField,
  sku: z.string(),
  productName: z.string(),
  locationId: uuidField,
  locationCode: z.string(),
  quantity: z.number().int(),
  pickedQuantity: z.number().int(),
});

// POST returns the row as inserted.
const createdPickTask = z.object({
  id: uuidField,
  salesOrderId: uuidField,
  status,
  createdAt: timestampField,
  completedAt: timestampField.nullable(),
});

const pickResult = z.object({
  pickTaskId: uuidField,
  pickTaskItemId: uuidField,
  productId: uuidField,
  locationId: uuidField,
  quantity: z.number().int(),
  taskStatus: status.describe("The task's status after this pick."),
});

export const pickTaskOperations: Operation[] = [
  {
    method: "get",
    path: "/api/pick-tasks",
    tag,
    summary: "List pick tasks",
    description: "Newest first.",
    responses: { 200: { description: "Pick tasks", schema: listOf(pickTask) } },
  },
  {
    method: "get",
    path: "/api/pick-tasks/{id}",
    tag,
    summary: "Get a pick task with its lines",
    description: "Lines are ordered by location code.",
    params: pickTaskIdSchema,
    responses: {
      200: {
        description: "The task and its lines",
        schema: dataOf(pickTask.extend({ items: z.array(pickTaskItem) })),
      },
      400: badRequest("The id is not a UUID"),
      404: notFound("No pick task with this id"),
    },
  },
  {
    method: "post",
    path: "/api/pick-tasks",
    tag,
    summary: "Generate a pick task for an allocated sales order",
    description: "Moves the order to PICKING. 400 also covers an order that is not ALLOCATED.",
    body: generatePickTaskSchema,
    responses: {
      201: { description: "The created task", schema: dataOf(createdPickTask) },
      400: badRequest("Invalid data, or the order cannot be picked"),
      404: notFound("No sales order with this id"),
    },
  },
  {
    method: "post",
    path: "/api/pick-tasks/items/{itemId}/pick",
    tag,
    summary: "Record a pick against a task line",
    description:
      "Removes the quantity from on-hand and reserved, writes a PICK movement and updates task and order status. 400 also covers picking more than the line or the allocation.",
    params: pickTaskItemIdSchema,
    body: pickItemSchema,
    responses: {
      201: { description: "What was picked", schema: dataOf(pickResult) },
      400: badRequest("Invalid data, or the pick is not allowed"),
      404: notFound("No pick task line with this id"),
    },
  },
];
