import { db } from "../../db/index.js";
import { locations, products } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type {
  InventoryMovementsQuery,
  InventoryQuery,
  ReceiveStockInput,
} from "./inventory.schema.js";
import { inventoryRepository } from "./inventory.repository.js";

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

export class LocationNotFoundError extends Error {
  constructor() {
    super("Location not found");
    this.name = "LocationNotFoundError";
  }
}

export const inventoryService = {
  async list(query: InventoryQuery) {
    const rows = await inventoryRepository.findAll(query.search);

    return rows.map((row) => ({
      ...row,
      available: row.onHand - row.reserved - row.damaged,
    }));
  },

  async listMovements(query: InventoryMovementsQuery) {
    return inventoryRepository.findMovements(
      query.productId,
      query.locationId,
    );
  },

  async receiveStock(input: ReceiveStockInput) {
    const product = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product[0]) {
      throw new ProductNotFoundError();
    }

    const location = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.id, input.locationId))
      .limit(1);

    if (!location[0]) {
      throw new LocationNotFoundError();
    }

    return inventoryRepository.receiveStock(
      input.productId,
      input.locationId,
      input.quantity,
      input.reason,
    );
  },
};
