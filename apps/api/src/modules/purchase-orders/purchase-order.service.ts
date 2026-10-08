import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderStatusInput,
} from "./purchase-order.schema.js";
import { purchaseOrderRepository } from "./purchase-order.repository.js";

export class PurchaseOrderNotFoundError extends Error {
  constructor() {
    super("Purchase order not found");
    this.name = "PurchaseOrderNotFoundError";
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

export class PurchaseOrderAlreadyExistsError extends Error {
  constructor() {
    super("Purchase order number already exists");
    this.name = "PurchaseOrderAlreadyExistsError";
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

const isUniqueViolation = (error: unknown) =>
  getErrorCode(error) === "23505";

export const purchaseOrderService = {
  async list() {
    return purchaseOrderRepository.findAll();
  },

  async get(id: string) {
    const order = await purchaseOrderRepository.findById(id);

    if (!order) {
      throw new PurchaseOrderNotFoundError();
    }

    return order;
  },

  async create(input: CreatePurchaseOrderInput) {
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
      return await purchaseOrderRepository.create(
        {
          orderNumber: input.orderNumber,
          supplier: input.supplier,
          expectedAt: input.expectedAt
            ? new Date(input.expectedAt)
            : null,
        },
        input.items.map((item) => ({
          productId: item.productId,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unitCost: item.unitCost.toFixed(2),
        })),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PurchaseOrderAlreadyExistsError();
      }

      throw error;
    }
  },

  async updateStatus(
    id: string,
    input: UpdatePurchaseOrderStatusInput,
  ) {
    const order = await purchaseOrderRepository.updateStatus(
      id,
      input.status,
    );

    if (!order) {
      throw new PurchaseOrderNotFoundError();
    }

    return order;
  },
};
