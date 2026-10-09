import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  warehouses,
  locations,
  products,
  inventory,
  stockMovements,
  purchaseOrders,
  purchaseOrderItems,
} from "../../db/schema.js";
import { purchaseOrderRepository } from "./purchase-order.repository.js";

describe("purchaseOrderRepository.receiveItem integration", () => {
  const suffix = crypto.randomUUID();
  let warehouseId: string;
  let locationId: string;
  let productId: string;
  let orderId: string;
  let itemId: string;

  beforeAll(async () => {
    const [warehouse] = await db.insert(warehouses).values({
      code: `TEST-${suffix}`,
      name: "Integration Test Warehouse",
    }).returning({ id: warehouses.id });
    warehouseId = warehouse!.id;

    const [location] = await db.insert(locations).values({
      warehouseId,
      code: `TEST-${suffix}`,
      name: "Integration Test Location",
    }).returning({ id: locations.id });
    locationId = location!.id;

    const [product] = await db.insert(products).values({
      sku: `TEST-${suffix}`,
      name: "Integration Test Product",
      unitCost: "12.50",
    }).returning({ id: products.id });
    productId = product!.id;

    const [order] = await db.insert(purchaseOrders).values({
      orderNumber: `TEST-${suffix}`,
      supplier: "Integration Test Supplier",
      status: "ORDERED",
    }).returning({ id: purchaseOrders.id });
    orderId = order!.id;

    const [item] = await db.insert(purchaseOrderItems).values({
      purchaseOrderId: orderId,
      productId,
      orderedQuantity: 5,
      receivedQuantity: 0,
      unitCost: "12.50",
    }).returning({ id: purchaseOrderItems.id });
    itemId = item!.id;
  });

  afterAll(async () => {
    if (itemId) {
      await db.delete(stockMovements).where(eq(stockMovements.referenceId, itemId));
    }
    if (productId) {
      await db.delete(inventory).where(eq(inventory.productId, productId));
    }
    if (itemId) {
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId));
    }
    if (orderId) {
      await db.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId));
    }
    if (locationId) {
      await db.delete(locations).where(eq(locations.id, locationId));
    }
    if (warehouseId) {
      await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (productId) {
      await db.delete(products).where(eq(products.id, productId));
    }
  });

  it("updates inventory and order status atomically across partial and complete receipts", async () => {
    const partial = await purchaseOrderRepository.receiveItem(
      itemId, locationId, 2, "First delivery",
    );
    expect(partial.status).toBe("PARTIALLY_RECEIVED");

    let [item] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, itemId));
    expect(item!.receivedQuantity).toBe(2);

    let [stock] = await db.select().from(inventory)
      .where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(2);

    let movements = await db.select().from(stockMovements)
      .where(eq(stockMovements.referenceId, itemId));
    expect(movements).toHaveLength(1);
    expect(movements[0]!.quantity).toBe(2);
    expect(movements[0]!.type).toBe("RECEIPT");

    await expect(
      purchaseOrderRepository.receiveItem(itemId, locationId, 4, "Too many"),
    ).rejects.toThrow("Received quantity cannot exceed ordered quantity");

    [item] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, itemId));
    expect(item!.receivedQuantity).toBe(2);
    [stock] = await db.select().from(inventory)
      .where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(2);
    movements = await db.select().from(stockMovements)
      .where(eq(stockMovements.referenceId, itemId));
    expect(movements).toHaveLength(1);

    const complete = await purchaseOrderRepository.receiveItem(
      itemId, locationId, 3, "Final delivery",
    );
    expect(complete.status).toBe("RECEIVED");

    [item] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, itemId));
    expect(item!.receivedQuantity).toBe(5);

    [stock] = await db.select().from(inventory)
      .where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(5);

    const [order] = await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId));
    expect(order!.status).toBe("RECEIVED");

    movements = await db.select().from(stockMovements)
      .where(eq(stockMovements.referenceId, itemId));
    expect(movements).toHaveLength(2);
    expect(movements.reduce((sum, movement) => sum + movement.quantity, 0)).toBe(5);
  });
});
