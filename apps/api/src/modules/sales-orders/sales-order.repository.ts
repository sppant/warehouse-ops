import { eq, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  inventory,
  products,
  salesOrderItems,
  salesOrders,
} from "../../db/schema.js";

export const salesOrderRepository = {
  async findAll() {
    return db
      .select()
      .from(salesOrders)
      .orderBy(desc(salesOrders.createdAt));
  },

  async findById(id: string) {
    const order = await db
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.id, id))
      .limit(1);

    if (!order[0]) {
      return null;
    }

    const items = await db
      .select({
        id: salesOrderItems.id,
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        orderedQuantity: salesOrderItems.orderedQuantity,
        allocatedQuantity: salesOrderItems.allocatedQuantity,
        pickedQuantity: salesOrderItems.pickedQuantity,
        shippedQuantity: salesOrderItems.shippedQuantity,
      })
      .from(salesOrderItems)
      .innerJoin(products, eq(salesOrderItems.productId, products.id))
      .where(eq(salesOrderItems.salesOrderId, id));

    return {
      ...order[0],
      items,
    };
  },

  async create(
    order: typeof salesOrders.$inferInsert,
    items: Array<Omit<typeof salesOrderItems.$inferInsert, "salesOrderId">>,
  ) {
    return db.transaction(async (tx) => {
      const orderResult = await tx
        .insert(salesOrders)
        .values(order)
        .returning();

      const createdOrder = orderResult[0];

      if (!createdOrder) {
        throw new Error("Failed to create sales order");
      }

      const createdItems = await tx
        .insert(salesOrderItems)
        .values(
          items.map((item) => ({
            ...item,
            salesOrderId: createdOrder.id,
          })),
        )
        .returning();

      return {
        ...createdOrder,
        items: createdItems,
      };
    });
  },

  async allocate(id: string) {
    return db.transaction(async (tx) => {
      const orderResult = await tx
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.id, id))
        .for("update");

      const order = orderResult[0];

      if (!order) {
        throw new Error("Sales order not found");
      }

      if (order.status !== "PENDING") {
        throw new Error("Only pending sales orders can be allocated");
      }

      const items = await tx
        .select()
        .from(salesOrderItems)
        .where(eq(salesOrderItems.salesOrderId, id));

      for (const item of items) {
        const remainingToAllocate =
          item.orderedQuantity - item.allocatedQuantity;

        if (remainingToAllocate <= 0) {
          continue;
        }

        const availableRows = await tx
          .select({
            id: inventory.id,
            onHand: inventory.onHand,
            reserved: inventory.reserved,
            damaged: inventory.damaged,
          })
          .from(inventory)
          .where(eq(inventory.productId, item.productId))
          .for("update");

        const totalAvailable = availableRows.reduce(
          (sum, row) => sum + (row.onHand - row.reserved - row.damaged),
          0,
        );

        if (totalAvailable < remainingToAllocate) {
          throw new Error("Insufficient available inventory");
        }

        let remaining = remainingToAllocate;

        for (const row of availableRows) {
          if (remaining <= 0) {
            break;
          }

          const rowAvailable = row.onHand - row.reserved - row.damaged;

          if (rowAvailable <= 0) {
            continue;
          }

          const reserveQuantity = Math.min(rowAvailable, remaining);

          await tx
            .update(inventory)
            .set({
              reserved: sql`${inventory.reserved} + ${reserveQuantity}`,
              updatedAt: sql`now()`,
            })
            .where(eq(inventory.id, row.id));

          remaining -= reserveQuantity;
        }

        await tx
          .update(salesOrderItems)
          .set({ allocatedQuantity: item.orderedQuantity })
          .where(eq(salesOrderItems.id, item.id));
      }

      const updatedOrderResult = await tx
        .update(salesOrders)
        .set({ status: "ALLOCATED" })
        .where(eq(salesOrders.id, id))
        .returning();

      return updatedOrderResult[0];
    });
  },
};
