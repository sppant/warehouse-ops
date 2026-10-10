import { db } from "../../db/index.js";
import { locations, products } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type {
  InventoryMovementsQuery,
  InventoryQuery,
  ReceiveStockInput,
  ReleaseStockInput,
  ReserveStockInput,
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

export class InsufficientAvailableInventoryError extends Error {
  constructor() {
    super("Insufficient available inventory");
    this.name = "InsufficientAvailableInventoryError";
  }
}

export class InvalidReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReleaseError";
  }
}

const assertProductAndLocationExist = async (
  productId: string,
  locationId: string,
) => {
  const product = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product[0]) {
    throw new ProductNotFoundError();
  }

  const location = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  if (!location[0]) {
    throw new LocationNotFoundError();
  }
};

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
    await assertProductAndLocationExist(input.productId, input.locationId);

    return inventoryRepository.receiveStock(
      input.productId,
      input.locationId,
      input.quantity,
      input.reason,
    );
  },

  async reserveStock(input: ReserveStockInput) {
    await assertProductAndLocationExist(input.productId, input.locationId);

    try {
      return await inventoryRepository.reserveStock(
        input.productId,
        input.locationId,
        input.quantity,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Insufficient available inventory"
      ) {
        throw new InsufficientAvailableInventoryError();
      }

      throw error;
    }
  },

  async releaseStock(input: ReleaseStockInput) {
    await assertProductAndLocationExist(input.productId, input.locationId);

    try {
      return await inventoryRepository.releaseStock(
        input.productId,
        input.locationId,
        input.quantity,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Cannot release more than reserved quantity"
      ) {
        throw new InvalidReleaseError(error.message);
      }

      throw error;
    }
  },
};
