import { toCsv } from "../../lib/csv.js";
import { inventoryRepository } from "../inventory/inventory.repository.js";
import { productRepository } from "../products/product.repository.js";

export class ItemNotFoundError extends Error {
  constructor() {
    super("No product with this SKU");
    this.name = "ItemNotFoundError";
  }
}

const COLUMNS = [
  "createdAt",
  "sku",
  "productName",
  "locationCode",
  "type",
  "quantity",
  "referenceType",
  "referenceId",
  "reason",
];

export const itemService = {
  async movementsCsv(sku: string, locationId?: string) {
    const product = await productRepository.findBySku(sku);

    if (!product) {
      throw new ItemNotFoundError();
    }

    // Newest first, like GET /api/inventory/movements.
    const movements = await inventoryRepository.findMovements(product.id, locationId);

    return toCsv(
      COLUMNS,
      movements.map((movement) => [
        movement.createdAt.toISOString(),
        movement.sku,
        movement.productName,
        movement.locationCode,
        movement.type,
        movement.quantity,
        movement.referenceType,
        movement.referenceId,
        movement.reason,
      ]),
    );
  },
};
