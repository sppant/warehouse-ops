import { describe, expect, it } from "vitest";
import { receivePurchaseOrderItemSchema } from "./purchase-order.schema.js";

const validReceipt = {
  locationId: "203140d9-6a39-47e9-ad59-8464d8d882e4",
  quantity: 5,
  reason: "Initial delivery",
};

describe("receivePurchaseOrderItemSchema", () => {
  it("accepts valid receipt data", () => {
    expect(receivePurchaseOrderItemSchema.safeParse(validReceipt).success).toBe(true);
  });

  it("rejects zero and negative quantities", () => {
    for (const quantity of [0, -1]) {
      expect(
        receivePurchaseOrderItemSchema.safeParse({ ...validReceipt, quantity }).success,
      ).toBe(false);
    }
  });

  it("rejects fractional quantities", () => {
    expect(
      receivePurchaseOrderItemSchema.safeParse({ ...validReceipt, quantity: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects an invalid location ID", () => {
    expect(
      receivePurchaseOrderItemSchema.safeParse({
        ...validReceipt,
        locationId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("allows an omitted reason", () => {
    const { reason, ...receipt } = validReceipt;
    expect(receivePurchaseOrderItemSchema.safeParse(receipt).success).toBe(true);
  });

  it("rejects reasons longer than 500 characters", () => {
    expect(
      receivePurchaseOrderItemSchema.safeParse({
        ...validReceipt,
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("trims whitespace from the reason", () => {
    const result = receivePurchaseOrderItemSchema.parse({
      ...validReceipt,
      reason: "  Delivery  ",
    });
    expect(result.reason).toBe("Delivery");
  });
});
