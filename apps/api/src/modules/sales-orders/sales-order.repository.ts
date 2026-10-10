import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, salesOrderItems, salesOrders } from "../../db/schema.js";

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
};
