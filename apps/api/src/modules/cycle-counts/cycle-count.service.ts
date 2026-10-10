import { db } from "../../db/index.js";
import { locations, products } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { RecordCycleCountInput } from "./cycle-count.schema.js";
import { cycleCountRepository } from "./cycle-count.repository.js";

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

export class CycleCountNotFoundError extends Error {
  constructor() {
    super("Cycle count not found");
    this.name = "CycleCountNotFoundError";
  }
}

export class InvalidCycleCountStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCycleCountStateError";
  }
}

const mapReviewError = (error: unknown, invalidStateMessages: string[]): never => {
  if (error instanceof Error && error.message === "Cycle count not found") {
    throw new CycleCountNotFoundError();
  }

  if (error instanceof Error && invalidStateMessages.includes(error.message)) {
    throw new InvalidCycleCountStateError(error.message);
  }

  throw error;
};

export const cycleCountService = {
  async list() {
    return cycleCountRepository.findAll();
  },

  async get(id: string) {
    const count = await cycleCountRepository.findById(id);

    if (!count) {
      throw new CycleCountNotFoundError();
    }

    return count;
  },

  async record(input: RecordCycleCountInput) {
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

    return cycleCountRepository.record(
      input.productId,
      input.locationId,
      input.countedQuantity,
      input.reason,
    );
  },

  async approve(id: string) {
    try {
      return await cycleCountRepository.approve(id);
    } catch (error) {
      mapReviewError(error, [
        "Only pending cycle counts can be approved",
        "Inventory record not found for this location",
        "Adjustment would result in negative on-hand inventory",
      ]);
    }
  },

  async reject(id: string) {
    try {
      return await cycleCountRepository.reject(id);
    } catch (error) {
      mapReviewError(error, ["Only pending cycle counts can be rejected"]);
    }
  },
};
