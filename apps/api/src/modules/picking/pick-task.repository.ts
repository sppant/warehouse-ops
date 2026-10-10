import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  inventory,
  locations,
  pickTaskItems,
  pickTasks,
  products,
  salesOrderItems,
  salesOrders,
  stockMovements,
} from "../../db/schema.js";

export const pickTaskRepository = {
  async findAll() {
    return db.select().from(pickTasks).orderBy(desc(pickTasks.createdAt));
  },

  async findById(id: string) {
    const task = await db
      .select()
      .from(pickTasks)
      .where(eq(pickTasks.id, id))
      .limit(1);

    if (!task[0]) {
      return null;
    }

    const items = await db
      .select({
        id: pickTaskItems.id,
        salesOrderItemId: pickTaskItems.salesOrderItemId,
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        locationId: locations.id,
        locationCode: locations.code,
        quantity: pickTaskItems.quantity,
        pickedQuantity: pickTaskItems.pickedQuantity,
      })
      .from(pickTaskItems)
      .innerJoin(products, eq(pickTaskItems.productId, products.id))
      .innerJoin(locations, eq(pickTaskItems.locationId, locations.id))
      .where(eq(pickTaskItems.pickTaskId, id))
      .orderBy(asc(locations.code));

    return {
      ...task[0],
      items,
    };
  },

  async generateForSalesOrder(salesOrderId: string) {
    return db.transaction(async (tx) => {
      const orderResult = await tx
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.id, salesOrderId))
        .for("update");

      const order = orderResult[0];

      if (!order) {
        throw new Error("Sales order not found");
      }

      if (order.status !== "ALLOCATED") {
        throw new Error(
          "Only allocated sales orders can generate a pick task",
        );
      }

      const items = await tx
        .select()
        .from(salesOrderItems)
        .where(eq(salesOrderItems.salesOrderId, salesOrderId));

      const itemsToInsert: Array<
        Omit<typeof pickTaskItems.$inferInsert, "pickTaskId">
      > = [];

      for (const item of items) {
        let remaining = item.allocatedQuantity - item.pickedQuantity;

        if (remaining <= 0) {
          continue;
        }

        const availableRows = await tx
          .select({
            locationId: inventory.locationId,
            onHand: inventory.onHand,
            reserved: inventory.reserved,
            damaged: inventory.damaged,
          })
          .from(inventory)
          .innerJoin(locations, eq(inventory.locationId, locations.id))
          .where(eq(inventory.productId, item.productId))
          .orderBy(asc(locations.code));

        for (const row of availableRows) {
          if (remaining <= 0) {
            break;
          }

          const pickable = Math.min(
            row.onHand - row.damaged,
            row.reserved,
          );

          if (pickable <= 0) {
            continue;
          }

          const pickQuantity = Math.min(pickable, remaining);

          itemsToInsert.push({
            salesOrderItemId: item.id,
            productId: item.productId,
            locationId: row.locationId,
            quantity: pickQuantity,
          });

          remaining -= pickQuantity;
        }

        if (remaining > 0) {
          throw new Error("Insufficient inventory to generate pick task");
        }
      }

      if (itemsToInsert.length === 0) {
        throw new Error("Sales order has nothing left to pick");
      }

      const [task] = await tx
        .insert(pickTasks)
        .values({ salesOrderId })
        .returning();

      if (!task) {
        throw new Error("Failed to create pick task");
      }

      await tx.insert(pickTaskItems).values(
        itemsToInsert.map((item) => ({
          ...item,
          pickTaskId: task.id,
        })),
      );

      await tx
        .update(salesOrders)
        .set({ status: "PICKING" })
        .where(eq(salesOrders.id, salesOrderId));

      return task;
    });
  },

  async pick(pickTaskItemId: string, quantity: number, reason?: string) {
    return db.transaction(async (tx) => {
      const itemResult = await tx
        .select({
          id: pickTaskItems.id,
          pickTaskId: pickTaskItems.pickTaskId,
          salesOrderItemId: pickTaskItems.salesOrderItemId,
          productId: pickTaskItems.productId,
          locationId: pickTaskItems.locationId,
          quantity: pickTaskItems.quantity,
          pickedQuantity: pickTaskItems.pickedQuantity,
          taskStatus: pickTasks.status,
          salesOrderId: pickTasks.salesOrderId,
        })
        .from(pickTaskItems)
        .innerJoin(pickTasks, eq(pickTaskItems.pickTaskId, pickTasks.id))
        .where(eq(pickTaskItems.id, pickTaskItemId))
        .for("update");

      const item = itemResult[0];

      if (!item) {
        throw new Error("Pick task item not found");
      }

      if (item.taskStatus === "CANCELLED" || item.taskStatus === "COMPLETED") {
        throw new Error(
          "Cannot pick for a cancelled or completed pick task",
        );
      }

      if (item.pickedQuantity + quantity > item.quantity) {
        throw new Error(
          "Picked quantity cannot exceed the pick task item quantity",
        );
      }

      const salesOrderItemResult = await tx
        .select({
          id: salesOrderItems.id,
          allocatedQuantity: salesOrderItems.allocatedQuantity,
          pickedQuantity: salesOrderItems.pickedQuantity,
        })
        .from(salesOrderItems)
        .where(eq(salesOrderItems.id, item.salesOrderItemId))
        .for("update");

      const salesOrderItem = salesOrderItemResult[0];

      if (!salesOrderItem) {
        throw new Error("Sales order item not found");
      }

      if (
        salesOrderItem.pickedQuantity + quantity >
        salesOrderItem.allocatedQuantity
      ) {
        throw new Error(
          "Picked quantity cannot exceed the allocated quantity",
        );
      }

      const inventoryResult = await tx
        .select({
          id: inventory.id,
          onHand: inventory.onHand,
          reserved: inventory.reserved,
        })
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, item.productId),
            eq(inventory.locationId, item.locationId),
          ),
        )
        .for("update");

      const inventoryRow = inventoryResult[0];

      if (
        !inventoryRow ||
        inventoryRow.onHand < quantity ||
        inventoryRow.reserved < quantity
      ) {
        throw new Error("Insufficient reserved inventory at location");
      }

      await tx
        .update(inventory)
        .set({
          onHand: sql`${inventory.onHand} - ${quantity}`,
          reserved: sql`${inventory.reserved} - ${quantity}`,
          updatedAt: sql`now()`,
        })
        .where(eq(inventory.id, inventoryRow.id));

      await tx.insert(stockMovements).values({
        productId: item.productId,
        locationId: item.locationId,
        type: "PICK",
        quantity,
        referenceType: "PICK_TASK_ITEM",
        referenceId: pickTaskItemId,
        reason: reason ?? null,
      });

      await tx
        .update(pickTaskItems)
        .set({
          pickedQuantity: sql`${pickTaskItems.pickedQuantity} + ${quantity}`,
        })
        .where(eq(pickTaskItems.id, pickTaskItemId));

      await tx
        .update(salesOrderItems)
        .set({
          pickedQuantity: sql`${salesOrderItems.pickedQuantity} + ${quantity}`,
        })
        .where(eq(salesOrderItems.id, item.salesOrderItemId));

      const taskItems = await tx
        .select({
          quantity: pickTaskItems.quantity,
          pickedQuantity: pickTaskItems.pickedQuantity,
        })
        .from(pickTaskItems)
        .where(eq(pickTaskItems.pickTaskId, item.pickTaskId));

      const taskComplete = taskItems.every(
        (entry) => entry.pickedQuantity >= entry.quantity,
      );

      const newTaskStatus = taskComplete ? "COMPLETED" : "IN_PROGRESS";

      await tx
        .update(pickTasks)
        .set({
          status: newTaskStatus,
          ...(taskComplete ? { completedAt: sql`now()` } : {}),
        })
        .where(eq(pickTasks.id, item.pickTaskId));

      const orderItems = await tx
        .select({
          allocatedQuantity: salesOrderItems.allocatedQuantity,
          pickedQuantity: salesOrderItems.pickedQuantity,
        })
        .from(salesOrderItems)
        .where(eq(salesOrderItems.salesOrderId, item.salesOrderId));

      const orderFullyPicked = orderItems.every(
        (entry) => entry.pickedQuantity >= entry.allocatedQuantity,
      );

      if (orderFullyPicked) {
        await tx
          .update(salesOrders)
          .set({ status: "PICKED" })
          .where(eq(salesOrders.id, item.salesOrderId));
      }

      return {
        pickTaskId: item.pickTaskId,
        pickTaskItemId,
        productId: item.productId,
        locationId: item.locationId,
        quantity,
        taskStatus: newTaskStatus,
      };
    });
  },
};
