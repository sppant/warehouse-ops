import type {
  CreateProductInput,
  UpdateProductInput,
} from "./product.schema.js";
import { productRepository } from "./product.repository.js";

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

export class ProductSkuAlreadyExistsError extends Error {
  constructor() {
    super("A product with this SKU already exists");
    this.name = "ProductSkuAlreadyExistsError";
  }
}

const isUniqueViolation = (error: unknown) => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
};

export const productService = {
  async list(search?: string) {
    return productRepository.findAll(search);
  },

  async getById(id: string) {
    const product = await productRepository.findById(id);

    if (!product) {
      throw new ProductNotFoundError();
    }

    return product;
  },

  async create(input: CreateProductInput) {
    try {
      return await productRepository.create({
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        unitCost: input.unitCost.toFixed(2),
        unitWeightGrams: input.unitWeightGrams ?? null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProductSkuAlreadyExistsError();
      }

      throw error;
    }
  },

  async update(id: string, input: UpdateProductInput) {
    await this.getById(id);

    const { unitCost, ...rest } = input;

    const data = {
      ...rest,
      ...(unitCost !== undefined
        ? { unitCost: unitCost.toFixed(2) }
        : {}),
    };

    return productRepository.update(id, data);
  },
};
