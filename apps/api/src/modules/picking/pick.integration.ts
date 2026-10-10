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
  pickTasks,
  pickTaskItems,
  stockMovements,
} from "../../db/schema.js";
import { salesOrderRepository } from "../sales-orders/sales-order.repository.js";
import { pickTaskRepository } from "./pick-task.repository.js";

describe("pickTaskRepository.pick integration", () => {
  const suffix = crypto.randomUUID();
  let warehouseId: string;
  let locationAId: string;
  let productId: string;

  const createdOrderIds: string[] = [];
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    const [warehouse] = await db.insert(warehouses).values({
      code: `TEST-PICK-${suffix}`,
      name: "Integration Test Warehouse",
    }).returning({ id: warehouses.id });
    warehouseId = warehouse!.id;

    const [locationA] = await db.insert(locations).values({
      warehouseId,
      code: `TEST-PICK-A-${suffix}`,
      name: "Integration Test Location A",
    }).returning({ id: locations.id });
    locationAId = locationA!.id;

    const [product] = await db.insert(products).values({
      sku: `TEST-PICK-${suffix}`,
      name: "Integration Test Pick Product",
      unitCost: "8.00",
    }).returning({ id: products.id });
    productId = product!.id;
  });

  afterAll(async () => {
    for (const taskId of createdTaskIds) {
      await db.delete(pickTaskItems).where(eq(pickTaskItems.pickTaskId, taskId));
      await db.delete(pickTasks).where(eq(pickTasks.id, taskId));
    }
    for (const orderId of createdOrderIds) {
      await db.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, orderId));
      await db.delete(salesOrders).where(eq(salesOrders.id, orderId));
    }
    if (productId) {
      await db.delete(stockMovements).where(eq(stockMovements.productId, productId));
      await db.delete(inventory).where(eq(inventory.productId, productId));
      await db.delete(products).where(eq(products.id, productId));
    }
    if (locationAId) {
      await db.delete(locations).where(eq(locations.id, locationAId));
    }
    if (warehouseId) {
      await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
  });

  const setupAllocatedTask = async (
    orderNumber: string,
    onHand: number,
    orderedQuantity: number,
  ) => {
    await db.insert(inventory).values({
      productId,
      locationId: locationAId,
      onHand,
    });

    const [order] = await db.insert(salesOrders).values({
      orderNumber,
      customer: "Integration Test Customer",
    }).returning({ id: salesOrders.id });
    createdOrderIds.push(order!.id);

    await db.insert(salesOrderItems).values({
      salesOrderId: order!.id,
      productId,
      orderedQuantity,
    });

    await salesOrderRepository.allocate(order!.id);
    const task = await pickTaskRepository.generateForSalesOrder(order!.id);
    createdTaskIds.push(task!.id);

    const items = await db.select().from(pickTaskItems)
      .where(eq(pickTaskItems.pickTaskId, task!.id));

    return { orderId: order!.id, taskId: task!.id, item: items[0]! };
  };

  const resetInventory = async () => {
    await db.delete(inventory).where(eq(inventory.productId, productId));
  };

  it("picks a task item and cascades to a completed task and a picked order", async () => {
    const { orderId, taskId, item } = await setupAllocatedTask(
      `TEST-PICK-FULL-${suffix}`,
      5,
      5,
    );

    const result = await pickTaskRepository.pick(item.id, 5);
    expect(result.taskStatus).toBe("COMPLETED");

    const [task] = await db.select().from(pickTasks).where(eq(pickTasks.id, taskId));
    expect(task!.status).toBe("COMPLETED");
    expect(task!.completedAt).not.toBeNull();

    const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, orderId));
    expect(order!.status).toBe("PICKED");

    const [stock] = await db.select().from(inventory).where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(0);
    expect(stock!.reserved).toBe(0);

    await resetInventory();
  });

  it("rejects picking more than the task item's quantity", async () => {
    const { item } = await setupAllocatedTask(
      `TEST-PICK-OVER-${suffix}`,
      5,
      5,
    );

    await expect(
      pickTaskRepository.pick(item.id, 6),
    ).rejects.toThrow("Picked quantity cannot exceed the pick task item quantity");

    const [taskItem] = await db.select().from(pickTaskItems).where(eq(pickTaskItems.id, item.id));
    expect(taskItem!.pickedQuantity).toBe(0);

    const [stock] = await db.select().from(inventory).where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(5);
    expect(stock!.reserved).toBe(5);

    await resetInventory();
  });

  it("rejects picking for a cancelled pick task", async () => {
    const { taskId, item } = await setupAllocatedTask(
      `TEST-PICK-CANCELLED-${suffix}`,
      5,
      5,
    );

    await db.update(pickTasks).set({ status: "CANCELLED" }).where(eq(pickTasks.id, taskId));

    await expect(
      pickTaskRepository.pick(item.id, 1),
    ).rejects.toThrow("Cannot pick for a cancelled or completed pick task");

    const [stock] = await db.select().from(inventory).where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(5);

    await resetInventory();
  });

  it("rejects picking a pick task item that does not exist", async () => {
    await expect(
      pickTaskRepository.pick(crypto.randomUUID(), 1),
    ).rejects.toThrow("Pick task item not found");
  });

  it("rejects picking when reserved inventory has drifted below the request", async () => {
    const { item } = await setupAllocatedTask(
      `TEST-PICK-DRIFT-${suffix}`,
      5,
      5,
    );

    await db.update(inventory)
      .set({ reserved: 2 })
      .where(eq(inventory.productId, productId));

    await expect(
      pickTaskRepository.pick(item.id, 5),
    ).rejects.toThrow("Insufficient reserved inventory at location");

    const [taskItem] = await db.select().from(pickTaskItems).where(eq(pickTaskItems.id, item.id));
    expect(taskItem!.pickedQuantity).toBe(0);

    await resetInventory();
  });

  it("allows only one of two concurrent picks to succeed beyond the item's quantity", async () => {
    const { item } = await setupAllocatedTask(
      `TEST-PICK-RACE-${suffix}`,
      5,
      5,
    );

    const [resultA, resultB] = await Promise.allSettled([
      pickTaskRepository.pick(item.id, 3),
      pickTaskRepository.pick(item.id, 3),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toBe(
      "Picked quantity cannot exceed the pick task item quantity",
    );

    const [taskItem] = await db.select().from(pickTaskItems).where(eq(pickTaskItems.id, item.id));
    expect(taskItem!.pickedQuantity).toBe(3);

    const [stock] = await db.select().from(inventory).where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(2);
    expect(stock!.reserved).toBe(2);

    await resetInventory();
  });

  it("safely picks two orders sharing the same location concurrently", async () => {
    await db.insert(inventory).values({
      productId,
      locationId: locationAId,
      onHand: 4,
    });

    const [orderA] = await db.insert(salesOrders).values({
      orderNumber: `TEST-PICK-SHARED-A-${suffix}`,
      customer: "Integration Test Customer",
    }).returning({ id: salesOrders.id });
    createdOrderIds.push(orderA!.id);

    const [orderB] = await db.insert(salesOrders).values({
      orderNumber: `TEST-PICK-SHARED-B-${suffix}`,
      customer: "Integration Test Customer",
    }).returning({ id: salesOrders.id });
    createdOrderIds.push(orderB!.id);

    await db.insert(salesOrderItems).values([
      { salesOrderId: orderA!.id, productId, orderedQuantity: 2 },
      { salesOrderId: orderB!.id, productId, orderedQuantity: 2 },
    ]);

    await salesOrderRepository.allocate(orderA!.id);
    await salesOrderRepository.allocate(orderB!.id);

    const taskA = await pickTaskRepository.generateForSalesOrder(orderA!.id);
    const taskB = await pickTaskRepository.generateForSalesOrder(orderB!.id);
    createdTaskIds.push(taskA!.id, taskB!.id);

    const [itemA] = await db.select().from(pickTaskItems)
      .where(eq(pickTaskItems.pickTaskId, taskA!.id));
    const [itemB] = await db.select().from(pickTaskItems)
      .where(eq(pickTaskItems.pickTaskId, taskB!.id));

    const [resultA, resultB] = await Promise.all([
      pickTaskRepository.pick(itemA!.id, 2),
      pickTaskRepository.pick(itemB!.id, 2),
    ]);

    expect(resultA.taskStatus).toBe("COMPLETED");
    expect(resultB.taskStatus).toBe("COMPLETED");

    const [stock] = await db.select().from(inventory).where(eq(inventory.productId, productId));
    expect(stock!.onHand).toBe(0);
    expect(stock!.reserved).toBe(0);

    const [orderARow] = await db.select().from(salesOrders).where(eq(salesOrders.id, orderA!.id));
    const [orderBRow] = await db.select().from(salesOrders).where(eq(salesOrders.id, orderB!.id));
    expect(orderARow!.status).toBe("PICKED");
    expect(orderBRow!.status).toBe("PICKED");

    await resetInventory();
  });
});
