import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  products,
  purchaseOrderItems,
  purchaseOrders,
} from "../../db/schema.js";

export const purchaseOrderRepository = {
  async findAll() {
    return db
      .select()
      .from(purchaseOrders)
      .orderBy(desc(purchaseOrders.createdAt));
  },

  async findById(id: string) {
    const order = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1);

    if (!order[0]) {
      return null;
    }

    const items = await db
      .select({
        id: purchaseOrderItems.id,
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        orderedQuantity: purchaseOrderItems.orderedQuantity,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
        unitCost: purchaseOrderItems.unitCost,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        products,
        eq(purchaseOrderItems.productId, products.id),
      )
      .where(eq(purchaseOrderItems.purchaseOrderId, id));

    return {
      ...order[0],
      items,
    };
  },

  async create(
    order: typeof purchaseOrders.$inferInsert,
    items: Array<
      Omit<typeof purchaseOrderItems.$inferInsert, "purchaseOrderId">
    >,
  ) {
    return db.transaction(async (tx) => {
      const orderResult = await tx
        .insert(purchaseOrders)
        .values(order)
        .returning();

      const createdOrder = orderResult[0];

      if (!createdOrder) {
        throw new Error("Failed to create purchase order");
      }

      const createdItems = await tx
        .insert(purchaseOrderItems)
        .values(
          items.map((item) => ({
            ...item,
            purchaseOrderId: createdOrder.id,
          })),
        )
        .returning();

      return {
        ...createdOrder,
        items: createdItems,
      };
    });
  },

  async updateStatus(
    id: string,
    status: typeof purchaseOrders.$inferInsert.status,
  ) {
    const result = await db
      .update(purchaseOrders)
      .set({
        status,
        ...(status === "ORDERED"
          ? { orderedAt: new Date() }
          : {}),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    return result[0] ?? null;
  },
};
