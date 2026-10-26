import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { WarehouseApiClient } from "../api-client.js";
import { fail, guard, locationIdField, ok, skuField } from "./shared.js";

export const getItemMovementsInput = z.object({
  sku: skuField,
  locationId: locationIdField,
  limit: z.number().int().min(1).max(100).default(20).describe("Number of most recent movements to return (1-100, default 20)."),
});

const movementSchema = z.object({
  type: z.string(),
  quantity: z.number(),
  locationCode: z.string(),
  reason: z.string().nullable(),
  referenceType: z.string().nullable(),
  createdAt: z.string(),
});

export const getItemMovementsOutput = z.object({
  sku: z.string(),
  name: z.string(),
  total: z.number().describe("How many movements exist for this selection in total."),
  movements: z.array(movementSchema),
});

type ProductsResponse = { data: { id: string; sku: string; name: string }[] };

type MovementsResponse = {
  data: {
    type: string;
    quantity: number;
    locationCode: string;
    reason: string | null;
    referenceType: string | null;
    createdAt: string;
  }[];
};

export const getItemMovements = (
  client: WarehouseApiClient,
  input: z.infer<typeof getItemMovementsInput>,
) =>
  guard(async () => {
    const products = await client.get<ProductsResponse>("/api/products", {
      search: input.sku,
    });
    const product = products.data.find(
      (candidate) => candidate.sku.toLowerCase() === input.sku.toLowerCase(),
    );

    if (!product) {
      return fail(
        `No product with SKU "${input.sku}". Use search_items to find the exact SKU.`,
      );
    }

    // The API has no limit parameter yet: it returns the whole history,
    // newest first, so the limit is applied here.
    const response = await client.get<MovementsResponse>("/api/inventory/movements", {
      productId: product.id,
      locationId: input.locationId,
    });

    return ok({
      sku: product.sku,
      name: product.name,
      total: response.data.length,
      movements: response.data.slice(0, input.limit).map((movement) => ({
        type: movement.type,
        quantity: movement.quantity,
        locationCode: movement.locationCode,
        reason: movement.reason,
        referenceType: movement.referenceType,
        createdAt: movement.createdAt,
      })),
    });
  });

export const registerGetItemMovements = (server: McpServer, client: WarehouseApiClient) =>
  server.registerTool(
    "get_item_movements",
    {
      title: "Get item movements",
      description:
        "Recent stock movements (receipts, picks, damage, returns, adjustments, transfers) for one product by exact SKU, newest first. " +
        "Types: RECEIPT, RETURN and TRANSFER_IN add stock; PICK, DAMAGE and TRANSFER_OUT remove it; quantity is unsigned except ADJUSTMENT, which can be negative. " +
        "Optionally limit to one location. Read-only.",
      inputSchema: getItemMovementsInput,
      outputSchema: getItemMovementsOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) => getItemMovements(client, input),
  );
