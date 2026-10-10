import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { CreateSalesOrderInput } from "./sales-order.schema.js";
import { salesOrderRepository } from "./sales-order.repository.js";

export class SalesOrderNotFoundError extends Error {
  constructor() {
    super("Sales order not found");
    this.name = "SalesOrderNotFoundError";
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

export class SalesOrderAlreadyExistsError extends Error {
  constructor() {
    super("Sales order number already exists");
    this.name = "SalesOrderAlreadyExistsError";
  }
}

export class InvalidSalesOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSalesOrderStateError";
  }
}

export class InsufficientInventoryError extends Error {
  constructor() {
    super("Insufficient available inventory");
    this.name = "InsufficientInventoryError";
  }
}

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("cause" in error) {
    return getErrorCode(error.cause);
  }

  return undefined;
};

const isUniqueViolation = (error: unknown) => getErrorCode(error) === "23505";

const mapTransitionError = (
  error: unknown,
  invalidStateMessages: string[],
): never => {
  if (error instanceof Error && error.message === "Sales order not found") {
    throw new SalesOrderNotFoundError();
  }

  if (error instanceof Error && invalidStateMessages.includes(error.message)) {
    throw new InvalidSalesOrderStateError(error.message);
  }

  throw error;
};

export const salesOrderService = {
  async list() {
    return salesOrderRepository.findAll();
  },

  async get(id: string) {
    const order = await salesOrderRepository.findById(id);

    if (!order) {
      throw new SalesOrderNotFoundError();
    }

    return order;
  },

  async create(input: CreateSalesOrderInput) {
    for (const item of input.items) {
      const product = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      if (!product[0]) {
        throw new ProductNotFoundError();
      }
    }

    try {
      return await salesOrderRepository.create(
        {
          orderNumber: input.orderNumber,
          customer: input.customer,
        },
        input.items.map((item) => ({
          productId: item.productId,
          orderedQuantity: item.orderedQuantity,
        })),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new SalesOrderAlreadyExistsError();
      }

      throw error;
    }
  },

  async allocate(id: string) {
    try {
      return await salesOrderRepository.allocate(id);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Insufficient available inventory"
      ) {
        throw new InsufficientInventoryError();
      }

      mapTransitionError(error, [
        "Only pending sales orders can be allocated",
      ]);
    }
  },

  async pack(id: string) {
    try {
      return await salesOrderRepository.pack(id);
    } catch (error) {
      mapTransitionError(error, [
        "Only fully picked sales orders can be packed",
      ]);
    }
  },

  async ship(id: string) {
    try {
      return await salesOrderRepository.ship(id);
    } catch (error) {
      mapTransitionError(error, ["Only packed sales orders can be shipped"]);
    }
  },
};
