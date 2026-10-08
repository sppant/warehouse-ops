import { eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";

export const productRepository = {
  async findAll(search?: string) {
    return db
      .select()
      .from(products)
      .where(
        search
          ? or(
              ilike(products.sku, `%${search}%`),
              ilike(products.name, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(products.name);
  },

  async findById(id: string): Promise<typeof products.$inferSelect | null> {
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return result[0] ?? null;
  },

  async create(data: typeof products.$inferInsert) {
    const result = await db
      .insert(products)
      .values(data)
      .returning();

    return result[0];
  },

  async update(id: string, data: Partial<typeof products.$inferInsert>) {
    const result = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();

    return result[0] ?? null;
  },
};
