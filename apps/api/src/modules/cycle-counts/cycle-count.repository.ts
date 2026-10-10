import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  cycleCounts,
  inventory,
  locations,
  products,
  stockMovements,
} from "../../db/schema.js";

const selectedColumns = {
  id: cycleCounts.id,
  productId: products.id,
  sku: products.sku,
  productName: products.name,
  locationId: locations.id,
  locationCode: locations.code,
  expectedQuantity: cycleCounts.expectedQuantity,
  countedQuantity: cycleCounts.countedQuantity,
  difference: cycleCounts.difference,
  reason: cycleCounts.reason,
  status: cycleCounts.status,
  createdAt: cycleCounts.createdAt,
  reviewedAt: cycleCounts.reviewedAt,
};

export const cycleCountRepository = {
  async findAll() {
    return db
      .select(selectedColumns)
      .from(cycleCounts)
      .innerJoin(products, eq(cycleCounts.productId, products.id))
      .innerJoin(locations, eq(cycleCounts.locationId, locations.id))
      .orderBy(desc(cycleCounts.createdAt));
  },

  async findById(id: string) {
    const rows = await db
      .select(selectedColumns)
      .from(cycleCounts)
      .innerJoin(products, eq(cycleCounts.productId, products.id))
      .innerJoin(locations, eq(cycleCounts.locationId, locations.id))
      .where(eq(cycleCounts.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async record(
    productId: string,
    locationId: string,
    countedQuantity: number,
    reason?: string,
  ) {
    const inventoryResult = await db
      .select({ onHand: inventory.onHand })
      .from(inventory)
      .where(
        and(
          eq(inventory.productId, productId),
          eq(inventory.locationId, locationId),
        ),
      )
      .limit(1);

    const expectedQuantity = inventoryResult[0]?.onHand ?? 0;
    const difference = countedQuantity - expectedQuantity;

    const [created] = await db
      .insert(cycleCounts)
      .values({
        productId,
        locationId,
        expectedQuantity,
        countedQuantity,
        difference,
        reason: reason ?? null,
      })
      .returning();

    return created;
  },

  async approve(id: string) {
    return db.transaction(async (tx) => {
      const result = await tx
        .select()
        .from(cycleCounts)
        .where(eq(cycleCounts.id, id))
        .for("update");

      const count = result[0];

      if (!count) {
        throw new Error("Cycle count not found");
      }

      if (count.status !== "PENDING") {
        throw new Error("Only pending cycle counts can be approved");
      }

      if (count.difference !== 0) {
        const inventoryResult = await tx
          .select({ id: inventory.id, onHand: inventory.onHand })
          .from(inventory)
          .where(
            and(
              eq(inventory.productId, count.productId),
              eq(inventory.locationId, count.locationId),
            ),
          )
          .for("update");

        const inventoryRow = inventoryResult[0];

        if (!inventoryRow) {
          throw new Error("Inventory record not found for this location");
        }

        if (inventoryRow.onHand + count.difference < 0) {
          throw new Error(
            "Adjustment would result in negative on-hand inventory",
          );
        }

        await tx
          .update(inventory)
          .set({
            onHand: sql`${inventory.onHand} + ${count.difference}`,
            updatedAt: sql`now()`,
          })
          .where(eq(inventory.id, inventoryRow.id));

        await tx.insert(stockMovements).values({
          productId: count.productId,
          locationId: count.locationId,
          type: "ADJUSTMENT",
          quantity: count.difference,
          referenceType: "CYCLE_COUNT",
          referenceId: id,
          reason: count.reason,
        });
      }

      const updated = await tx
        .update(cycleCounts)
        .set({ status: "APPROVED", reviewedAt: sql`now()` })
        .where(eq(cycleCounts.id, id))
        .returning();

      return updated[0];
    });
  },

  async reject(id: string) {
    return db.transaction(async (tx) => {
      const result = await tx
        .select()
        .from(cycleCounts)
        .where(eq(cycleCounts.id, id))
        .for("update");

      const count = result[0];

      if (!count) {
        throw new Error("Cycle count not found");
      }

      if (count.status !== "PENDING") {
        throw new Error("Only pending cycle counts can be rejected");
      }

      const updated = await tx
        .update(cycleCounts)
        .set({ status: "REJECTED", reviewedAt: sql`now()` })
        .where(eq(cycleCounts.id, id))
        .returning();

      return updated[0];
    });
  },
};
