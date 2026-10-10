import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  inventory,
  locations,
  pickTaskItems,
  pickTasks,
  products,
  salesOrderItems,
  salesOrders,
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
};
