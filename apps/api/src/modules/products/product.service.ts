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
    return productRepository.create({
      sku: input.sku,
      name: input.name,
      description: input.description ?? null,
      unitCost: input.unitCost.toFixed(2),
      unitWeightGrams: input.unitWeightGrams ?? null,
    });
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
