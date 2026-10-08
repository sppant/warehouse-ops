import { eq, desc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  products,
  purchaseOrderItems,
  purchaseOrders,
  inventory,
  locations,
  stockMovements,
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

  async receiveItem(
    purchaseOrderItemId: string,
    locationId: string,
    quantity: number,
    reason?: string,
  ) {
    return db.transaction(async (tx) => {
      const itemResult = await tx
        .select({
          id: purchaseOrderItems.id,
          purchaseOrderId: purchaseOrderItems.purchaseOrderId,
          productId: purchaseOrderItems.productId,
          orderedQuantity: purchaseOrderItems.orderedQuantity,
          receivedQuantity: purchaseOrderItems.receivedQuantity,
          orderStatus: purchaseOrders.status,
        })
        .from(purchaseOrderItems)
        .innerJoin(
          purchaseOrders,
          eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id),
        )
        .where(eq(purchaseOrderItems.id, purchaseOrderItemId))
        .for("update");

      const item = itemResult[0];

      if (!item) {
        throw new Error("Purchase order item not found");
      }

      if (item.orderStatus === "CANCELLED") {
        throw new Error("Cannot receive a cancelled purchase order");
      }

      if (item.receivedQuantity + quantity > item.orderedQuantity) {
        throw new Error(
          "Received quantity cannot exceed ordered quantity",
        );
      }

      const locationResult = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.id, locationId))
        .limit(1);

      if (!locationResult[0]) {
        throw new Error("Location not found");
      }

      const updatedItemResult = await tx
        .update(purchaseOrderItems)
        .set({
          receivedQuantity: sql`${purchaseOrderItems.receivedQuantity} + ${quantity}`,
        })
        .where(eq(purchaseOrderItems.id, purchaseOrderItemId))
        .returning();

      const updatedItem = updatedItemResult[0];

      if (!updatedItem) {
        throw new Error("Failed to update purchase order item");
      }

      await tx
        .insert(inventory)
        .values({
          productId: item.productId,
          locationId,
          onHand: quantity,
        })
        .onConflictDoUpdate({
          target: [inventory.productId, inventory.locationId],
          set: {
            onHand: sql`${inventory.onHand} + ${quantity}`,
            updatedAt: sql`now()`,
          },
        });

      await tx.insert(stockMovements).values({
        productId: item.productId,
        locationId,
        type: "RECEIPT",
        quantity,
        referenceType: "PURCHASE_ORDER_ITEM",
        referenceId: purchaseOrderItemId,
        reason: reason ?? null,
      });

      const remainingItems = await tx
        .select({
          orderedQuantity: purchaseOrderItems.orderedQuantity,
          receivedQuantity: purchaseOrderItems.receivedQuantity,
        })
        .from(purchaseOrderItems)
        .where(
          eq(
            purchaseOrderItems.purchaseOrderId,
            item.purchaseOrderId,
          ),
        );

      const allReceived = remainingItems.every(
        (entry) => entry.receivedQuantity >= entry.orderedQuantity,
      );

      const anyReceived = remainingItems.some(
        (entry) => entry.receivedQuantity > 0,
      );

      const newStatus = allReceived
        ? "RECEIVED"
        : anyReceived
          ? "PARTIALLY_RECEIVED"
          : item.orderStatus;

      await tx
        .update(purchaseOrders)
        .set({ status: newStatus })
        .where(eq(purchaseOrders.id, item.purchaseOrderId));

      return {
        purchaseOrderId: item.purchaseOrderId,
        purchaseOrderItemId,
        productId: item.productId,
        locationId,
        quantity,
        status: newStatus,
      };
    });
  },
};
