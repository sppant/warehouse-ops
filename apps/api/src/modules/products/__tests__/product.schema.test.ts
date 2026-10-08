import { describe, expect, it } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
} from "../product.schema.js";

describe("createProductSchema", () => {
  it("accepts a valid product", () => {
    const result = createProductSchema.safeParse({
      sku: "SKU-001",
      name: "Test Product",
      description: "A test product",
      unitCost: 19.99,
      unitWeightGrams: 250,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty SKU", () => {
    const result = createProductSchema.safeParse({
      sku: "",
      name: "Test Product",
      unitCost: 19.99,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative prices", () => {
    const result = createProductSchema.safeParse({
      sku: "SKU-001",
      name: "Test Product",
      unitCost: -10,
    });

    expect(result.success).toBe(false);
  });

  it("allows partial updates", () => {
    const result = updateProductSchema.safeParse({
      name: "Updated Product",
    });

    expect(result.success).toBe(true);
  });
});
