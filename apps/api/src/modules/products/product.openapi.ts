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
import {
  createProductSchema,
  productIdSchema,
  updateProductSchema,
} from "./product.schema.js";

const tag = "Products";

const product = z.object({
  id: uuidField,
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  unitCost: z.string().describe("Decimal with 2 places, e.g. \"12.50\"."),
  unitWeightGrams: z.number().int().nullable(),
  isActive: z.boolean(),
  createdAt: timestampField,
});

// The route reads ?search= without a Zod schema, so this one exists only to
// describe it.
const productListQuery = z.object({
  search: z.string().optional().describe("Case-insensitive match on SKU or name."),
});

export const productOperations: Operation[] = [
  {
    method: "get",
    path: "/api/products",
    tag,
    summary: "List products",
    description: "Sorted by name. Optional search matches SKU or name.",
    query: productListQuery,
    responses: { 200: { description: "Products", schema: listOf(product) } },
  },
  {
    method: "get",
    path: "/api/products/{id}",
    tag,
    summary: "Get a product",
    params: productIdSchema,
    responses: {
      200: { description: "The product", schema: dataOf(product) },
      400: badRequest("The id is not a UUID"),
      404: notFound("No product with this id"),
    },
  },
  {
    method: "post",
    path: "/api/products",
    tag,
    summary: "Create a product",
    body: createProductSchema,
    responses: {
      201: { description: "The created product", schema: dataOf(product) },
      400: badRequest("Invalid product data"),
      // The route maps a duplicate SKU to 409, but the unique-violation check
      // in product.service does not unwrap Drizzle's error, so the API
      // currently answers 500. Not documented until that is fixed.
    },
  },
  {
    method: "patch",
    path: "/api/products/{id}",
    tag,
    summary: "Update a product",
    params: productIdSchema,
    body: updateProductSchema,
    responses: {
      200: { description: "The updated product", schema: dataOf(product) },
      400: badRequest("Invalid id or product data"),
      404: notFound("No product with this id"),
    },
  },
];
