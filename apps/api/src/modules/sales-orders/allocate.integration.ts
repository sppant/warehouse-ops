import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  warehouses,
  locations,
  products,
  inventory,
  salesOrders,
  salesOrderItems,
} from "../../db/schema.js";
import { salesOrderRepository } from "./sales-order.repository.js";

describe("salesOrderRepository.allocate integration", () => {
  const suffix = crypto.randomUUID();
  let warehouseId: string;
  let locationAId: string;
  let locationBId: string;
  let productId: string;
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const [warehouse] = await db.insert(warehouses).values({
      code: `TEST-${suffix}`,
      name: "Integration Test Warehouse",
    }).returning({ id: warehouses.id });
    warehouseId = warehouse!.id;

    const [locationA] = await db.insert(locations).values({
      warehouseId,
      code: `TEST-A-${suffix}`,
      name: "Integration Test Location A",
    }).returning({ id: locations.id });
    locationAId = locationA!.id;

    const [locationB] = await db.insert(locations).values({
      warehouseId,
      code: `TEST-B-${suffix}`,
      name: "Integration Test Location B",
    }).returning({ id: locations.id });
    locationBId = locationB!.id;

    const [product] = await db.insert(products).values({
      sku: `TEST-${suffix}`,
      name: "Integration Test Product",
      unitCost: "12.50",
    }).returning({ id: products.id });
    productId = product!.id;
  });

  afterAll(async () => {
    for (const orderId of createdOrderIds) {
      await db.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, orderId));
      await db.delete(salesOrders).where(eq(salesOrders.id, orderId));
    }
    if (productId) {
      await db.delete(inventory).where(eq(inventory.productId, productId));
      await db.delete(products).where(eq(products.id, productId));
    }
    if (locationAId) {
      await db.delete(locations).where(eq(locations.id, locationAId));
    }
    if (locationBId) {
      await db.delete(locations).where(eq(locations.id, locationBId));
    }
    if (warehouseId) {
      await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
  });

  const createOrder = async (
    orderNumber: string,
    orderedQuantity: number,
  ) => {
    const [order] = await db.insert(salesOrders).values({
      orderNumber,
      customer: "Integration Test Customer",
    }).returning({ id: salesOrders.id });
    createdOrderIds.push(order!.id);

    const [item] = await db.insert(salesOrderItems).values({
      salesOrderId: order!.id,
      productId,
      orderedQuantity,
    }).returning({ id: salesOrderItems.id });

    return { orderId: order!.id, itemId: item!.id };
  };

  it("reserves stock across multiple locations for a single order", async () => {
    await db.insert(inventory).values([
      { productId, locationId: locationAId, onHand: 3 },
      { productId, locationId: locationBId, onHand: 4 },
    ]);

    const { orderId, itemId } = await createOrder(
      `TEST-SPLIT-${suffix}`,
      5,
    );

    const result = await salesOrderRepository.allocate(orderId);
    expect(result!.status).toBe("ALLOCATED");

    const [item] = await db.select().from(salesOrderItems)
      .where(eq(salesOrderItems.id, itemId));
    expect(item!.allocatedQuantity).toBe(5);

    const stock = await db.select().from(inventory)
      .where(eq(inventory.productId, productId));
    const totalReserved = stock.reduce((sum, row) => sum + row.reserved, 0);
    expect(totalReserved).toBe(5);

    await db.delete(inventory).where(eq(inventory.productId, productId));
  });

  it("rejects allocation when available inventory is insufficient", async () => {
    await db.insert(inventory).values({
      productId,
      locationId: locationAId,
      onHand: 2,
    });

    const { orderId, itemId } = await createOrder(
      `TEST-SHORT-${suffix}`,
      5,
    );

    await expect(
      salesOrderRepository.allocate(orderId),
    ).rejects.toThrow("Insufficient available inventory");

    const [order] = await db.select().from(salesOrders)
      .where(eq(salesOrders.id, orderId));
    expect(order!.status).toBe("PENDING");

    const [item] = await db.select().from(salesOrderItems)
      .where(eq(salesOrderItems.id, itemId));
    expect(item!.allocatedQuantity).toBe(0);

    const [stock] = await db.select().from(inventory)
      .where(eq(inventory.productId, productId));
    expect(stock!.reserved).toBe(0);

    await db.delete(inventory).where(eq(inventory.productId, productId));
  });

  it("rejects allocating an order that is not pending", async () => {
    await db.insert(inventory).values({
      productId,
      locationId: locationAId,
      onHand: 5,
    });

    const { orderId } = await createOrder(`TEST-STATE-${suffix}`, 5);

    await salesOrderRepository.allocate(orderId);

    await expect(
      salesOrderRepository.allocate(orderId),
    ).rejects.toThrow("Only pending sales orders can be allocated");

    await db.delete(inventory).where(eq(inventory.productId, productId));
  });

  it("rejects allocating a sales order that does not exist", async () => {
    await expect(
      salesOrderRepository.allocate(crypto.randomUUID()),
    ).rejects.toThrow("Sales order not found");
  });

  it("allows only one of two concurrent allocations to succeed for contended stock", async () => {
    await db.insert(inventory).values({
      productId,
      locationId: locationAId,
      onHand: 5,
    });

    const orderA = await createOrder(`TEST-RACE-A-${suffix}`, 5);
    const orderB = await createOrder(`TEST-RACE-B-${suffix}`, 5);

    const [resultA, resultB] = await Promise.allSettled([
      salesOrderRepository.allocate(orderA.orderId),
      salesOrderRepository.allocate(orderB.orderId),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toBe(
      "Insufficient available inventory",
    );

    const [stock] = await db.select().from(inventory)
      .where(eq(inventory.productId, productId));
    expect(stock!.reserved).toBe(5);

    const orders = await db.select().from(salesOrders)
      .where(eq(salesOrders.id, orderA.orderId));
    const [orderBRow] = await db.select().from(salesOrders)
      .where(eq(salesOrders.id, orderB.orderId));

    const statuses = [orders[0]!.status, orderBRow!.status];
    expect(statuses.filter((status) => status === "ALLOCATED")).toHaveLength(1);
    expect(statuses.filter((status) => status === "PENDING")).toHaveLength(1);

    await db.delete(inventory).where(eq(inventory.productId, productId));
  });
});
