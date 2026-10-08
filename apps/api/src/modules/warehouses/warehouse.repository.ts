import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { locations, warehouses } from "../../db/schema.js";

export const warehouseRepository = {
  async findAll() {
    return db
      .select()
      .from(warehouses)
      .orderBy(warehouses.name);
  },

  async findById(id: string) {
    const result = await db
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, id))
      .limit(1);

    return result[0] ?? null;
  },

  async create(data: typeof warehouses.$inferInsert) {
    const result = await db
      .insert(warehouses)
      .values(data)
      .returning();

    return result[0];
  },

  async findLocations(warehouseId: string) {
    return db
      .select()
      .from(locations)
      .where(eq(locations.warehouseId, warehouseId))
      .orderBy(locations.code);
  },

  async findLocationByCode(warehouseId: string, code: string) {
    const result = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.warehouseId, warehouseId),
          eq(locations.code, code),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  },

  async createLocation(data: typeof locations.$inferInsert) {
    const result = await db
      .insert(locations)
      .values(data)
      .returning();

    return result[0];
  },
};
