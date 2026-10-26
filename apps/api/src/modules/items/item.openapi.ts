import { z } from "zod";
import type { Operation } from "../../openapi/define.js";
import { badRequest, notFound } from "../../openapi/common.js";
import { errorSchema } from "../../openapi/define.js";
import { itemMovementsCsvQuerySchema, itemSkuParamSchema } from "./item.schema.js";

const tag = "Items";

// Fastify's own body for a route that does not exist. It is what a client
// gets from this endpoint while its feature flag is off.
const routeNotFound = z.object({
  message: z.string(),
  error: z.string(),
  statusCode: z.literal(404),
});

export const itemOperations: Operation[] = [
  {
    method: "get",
    path: "/api/items/{sku}/movements.csv",
    tag,
    summary: "Export an item's stock movements as CSV",
    description: [
      "Behind a feature flag (movementsCsvExport), 404 when disabled.",
      "",
      "One row per stock movement of the product with this exact SKU, newest first, optionally limited to one location.",
      "Columns: createdAt (ISO 8601 UTC), sku, productName, locationCode, type, quantity, referenceType, referenceId, reason.",
      "Quantity is unsigned except for ADJUSTMENT, which can be negative. Empty values are empty cells.",
      "Lines end with CRLF (RFC 4180) and cells are quoted when needed. Text cells that start with = + - @ (or a tab or carriage return) are prefixed with an apostrophe so spreadsheets do not run them as formulas; quantity is always a plain number.",
      "An item with no movements returns the header row only.",
      "SKUs are at most 100 characters; a longer value cannot match a product, and Fastify refuses such a URL itself (414) before this route runs.",
    ].join("\n"),
    params: itemSkuParamSchema,
    query: itemMovementsCsvQuerySchema,
    responses: {
      200: {
        description: "The CSV file",
        contentType: "text/csv",
        schema: z.string(),
        headers: {
          "Content-Disposition": {
            description: 'attachment; filename="movements-<sku>.csv"',
            schema: z.string(),
          },
        },
      },
      400: badRequest("The SKU is blank, or locationId is not a UUID"),
      404: {
        description:
          "No product with this SKU, or the feature flag is disabled (then the route does not exist and Fastify's default body is returned)",
        schema: z.union([errorSchema, routeNotFound]),
      },
    },
  },
];
