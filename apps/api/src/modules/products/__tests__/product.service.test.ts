import { beforeEach, describe, expect, it, vi } from "vitest";
import { productRepository } from "../product.repository.js";
import {
  ProductNotFoundError,
  productService,
} from "../product.service.js";

vi.mock("../product.repository.js", () => ({
  productRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

describe("productService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a product with the database numeric format", async () => {
    vi.mocked(productRepository.create).mockResolvedValue({
      id: "product-1",
      sku: "SKU-001",
      name: "Test Product",
      description: null,
      unitCost: "24.50",
      unitWeightGrams: 500,
      isActive: true,
      createdAt: new Date(),
    });

    const result = await productService.create({
      sku: "SKU-001",
      name: "Test Product",
      description: null,
      unitCost: 24.5,
      unitWeightGrams: 500,
    });

    expect(productRepository.create).toHaveBeenCalledWith({
      sku: "SKU-001",
      name: "Test Product",
      description: null,
      unitCost: "24.50",
      unitWeightGrams: 500,
    });

    expect(result.unitCost).toBe("24.50");
  });

  it("throws when a product does not exist", async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(null);

    await expect(
      productService.getById("missing-product"),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it("updates only the supplied fields", async () => {
    vi.mocked(productRepository.findById).mockResolvedValue({
      id: "product-1",
      sku: "SKU-001",
      name: "Old Name",
      description: null,
      unitCost: "10.00",
      unitWeightGrams: 500,
      isActive: true,
      createdAt: new Date(),
    });

    vi.mocked(productRepository.update).mockResolvedValue({
      id: "product-1",
      sku: "SKU-001",
      name: "New Name",
      description: null,
      unitCost: "15.50",
      unitWeightGrams: 500,
      isActive: true,
      createdAt: new Date(),
    });

    await productService.update("product-1", {
      name: "New Name",
      unitCost: 15.5,
    });

    expect(productRepository.update).toHaveBeenCalledWith(
      "product-1",
      {
        name: "New Name",
        unitCost: "15.50",
      },
    );
  });
});
