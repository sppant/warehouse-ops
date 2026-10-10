import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  inventory,
  locations,
  stockMovements,
  products,
  warehouses,
} from "../../db/schema.js";

export const inventoryRepository = {
  async findAll(search?: string) {
    const rows = await db
      .select({
        id: inventory.id,
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        locationId: locations.id,
        locationCode: locations.code,
        locationName: locations.name,
        warehouseId: warehouses.id,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        onHand: inventory.onHand,
        reserved: inventory.reserved,
        damaged: inventory.damaged,
        updatedAt: inventory.updatedAt,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(locations, eq(inventory.locationId, locations.id))
      .innerJoin(warehouses, eq(locations.warehouseId, warehouses.id))
      .where(
        search
          ? or(
              ilike(products.sku, `%${search}%`),
              ilike(products.name, `%${search}%`),
              ilike(locations.code, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(products.name, locations.code);

    return rows;
  },

  async findMovements(productId?: string, locationId?: string) {
    return db
      .select({
        id: stockMovements.id,
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        locationId: locations.id,
        locationCode: locations.code,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        referenceType: stockMovements.referenceType,
        referenceId: stockMovements.referenceId,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(locations, eq(stockMovements.locationId, locations.id))
      .where(
        productId && locationId
          ? and(
              eq(stockMovements.productId, productId),
              eq(stockMovements.locationId, locationId),
            )
          : productId
            ? eq(stockMovements.productId, productId)
            : locationId
              ? eq(stockMovements.locationId, locationId)
              : undefined,
      )
      .orderBy(desc(stockMovements.createdAt));
  },

  async receiveStock(
    productId: string,
    locationId: string,
    quantity: number,
    reason?: string,
  ) {
    return db.transaction(async (tx) => {
      const inventoryResult = await tx
        .insert(inventory)
        .values({
          productId,
          locationId,
          onHand: quantity,
        })
        .onConflictDoUpdate({
          target: [inventory.productId, inventory.locationId],
          set: {
            onHand: sql`${inventory.onHand} + ${quantity}`,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      const inventoryRow = inventoryResult[0];

      if (!inventoryRow) {
        throw new Error("Failed to update inventory");
      }

      await tx.insert(stockMovements).values({
        productId,
        locationId,
        type: "RECEIPT",
        quantity,
        reason: reason ?? null,
      });

      return inventoryRow;
    });
  },

  async reserveStock(
    productId: string,
    locationId: string,
    quantity: number,
  ) {
    return db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: inventory.id,
          onHand: inventory.onHand,
          reserved: inventory.reserved,
          damaged: inventory.damaged,
        })
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, productId),
            eq(inventory.locationId, locationId),
          ),
        )
        .for("update");

      const row = rows[0];
      const available = row
        ? row.onHand - row.reserved - row.damaged
        : 0;

      if (available < quantity) {
        throw new Error("Insufficient available inventory");
      }

      const updated = await tx
        .update(inventory)
        .set({
          reserved: sql`${inventory.reserved} + ${quantity}`,
          updatedAt: sql`now()`,
        })
        .where(eq(inventory.id, row!.id))
        .returning();

      return updated[0];
    });
  },

  async releaseStock(
    productId: string,
    locationId: string,
    quantity: number,
  ) {
    return db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: inventory.id,
          reserved: inventory.reserved,
        })
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, productId),
            eq(inventory.locationId, locationId),
          ),
        )
        .for("update");

      const row = rows[0];

      if (!row || row.reserved < quantity) {
        throw new Error("Cannot release more than reserved quantity");
      }

      const updated = await tx
        .update(inventory)
        .set({
          reserved: sql`${inventory.reserved} - ${quantity}`,
          updatedAt: sql`now()`,
        })
        .where(eq(inventory.id, row.id))
        .returning();

      return updated[0];
    });
  },
};
