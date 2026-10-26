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
  createLocationSchema,
  createWarehouseSchema,
  warehouseIdSchema,
} from "./warehouse.schema.js";

const tag = "Warehouses";

const warehouse = z.object({
  id: uuidField,
  code: z.string(),
  name: z.string(),
  createdAt: timestampField,
});

const location = z.object({
  id: uuidField,
  warehouseId: uuidField,
  code: z.string(),
  name: z.string(),
  createdAt: timestampField,
});

export const warehouseOperations: Operation[] = [
  {
    method: "get",
    path: "/api/warehouses",
    tag,
    summary: "List warehouses",
    responses: { 200: { description: "Warehouses sorted by name", schema: listOf(warehouse) } },
  },
  {
    method: "get",
    path: "/api/warehouses/{id}",
    tag,
    summary: "Get a warehouse",
    params: warehouseIdSchema,
    responses: {
      200: { description: "The warehouse", schema: dataOf(warehouse) },
      400: badRequest("The id is not a UUID"),
      404: notFound("No warehouse with this id"),
    },
  },
  {
    method: "post",
    path: "/api/warehouses",
    tag,
    summary: "Create a warehouse",
    body: createWarehouseSchema,
    responses: {
      201: { description: "The created warehouse", schema: dataOf(warehouse) },
      400: badRequest("Invalid warehouse data"),
      409: conflict("A warehouse with this code already exists"),
    },
  },
  {
    method: "get",
    path: "/api/warehouses/{id}/locations",
    tag,
    summary: "List a warehouse's locations",
    params: warehouseIdSchema,
    responses: {
      200: { description: "Locations sorted by code", schema: listOf(location) },
      400: badRequest("The id is not a UUID"),
      404: notFound("No warehouse with this id"),
    },
  },
  {
    method: "post",
    path: "/api/warehouses/{id}/locations",
    tag,
    summary: "Create a location in a warehouse",
    params: warehouseIdSchema,
    body: createLocationSchema,
    responses: {
      201: { description: "The created location", schema: dataOf(location) },
      400: badRequest("Invalid id or location data"),
      404: notFound("No warehouse with this id"),
      409: conflict("A location with this code already exists in the warehouse"),
    },
  },
];
