import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "../../app.js";
import { db } from "../../db/index.js";
import {
  inventory,
  locations,
  products,
  stockMovements,
  warehouses,
} from "../../db/schema.js";

describe("PUT /api/inventory/:id/cycle-count-flag integration", () => {
  const app = buildApp();
  const tag = crypto.randomUUID().slice(0, 8);
  let warehouseId: string;
  let locationId: string;
  let productId: string;
  let inventoryId: string;

  const setFlag = (id: string, body: unknown) =>
    app.inject({
      method: "PUT",
      url: `/api/inventory/${id}/cycle-count-flag`,
      payload: body as object,
    });

  const readRow = async () => {
    const [row] = await db.select().from(inventory).where(eq(inventory.id, inventoryId));
    return row!;
  };

  beforeAll(async () => {
    const [warehouse] = await db
      .insert(warehouses)
      .values({ code: `FL-${tag}`, name: "Flag Test Warehouse" })
      .returning({ id: warehouses.id });
    warehouseId = warehouse!.id;

    const [location] = await db
      .insert(locations)
      .values({ warehouseId, code: `FL-${tag}`, name: "Flag Test Location" })
      .returning({ id: locations.id });
    locationId = location!.id;

    const [product] = await db
      .insert(products)
      .values({ sku: `FL-${tag}`, name: "Flag Test Product", unitCost: "1.00" })
      .returning({ id: products.id });
    productId = product!.id;

    const [row] = await db
      .insert(inventory)
      .values({ productId, locationId, onHand: 40, reserved: 5, damaged: 1 })
      .returning({ id: inventory.id });
    inventoryId = row!.id;
  });

  afterAll(async () => {
    await db.delete(stockMovements).where(eq(stockMovements.productId, productId));
    await db.delete(inventory).where(eq(inventory.id, inventoryId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(locations).where(eq(locations.id, locationId));
    await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    await app.close();
  });

  it("flags and unflags a row, and the overview reflects it", async () => {
    const flagged = await setFlag(inventoryId, { flagged: true });
    expect(flagged.statusCode).toBe(200);
    expect(flagged.json().data.cycleCountFlaggedAt).toEqual(expect.any(String));

    const overview = await app.inject({
      method: "GET",
      url: `/api/inventory/overview?locationId=${locationId}`,
    });
    expect(overview.json().data[0].cycleCountFlaggedAt).toBe(
      flagged.json().data.cycleCountFlaggedAt,
    );

    const cleared = await setFlag(inventoryId, { flagged: false });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().data.cycleCountFlaggedAt).toBeNull();
    expect((await readRow()).cycleCountFlaggedAt).toBeNull();
  });

  it("is idempotent: flagging twice keeps the first timestamp", async () => {
    const first = await setFlag(inventoryId, { flagged: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await setFlag(inventoryId, { flagged: true });

    expect(second.json().data.cycleCountFlaggedAt).toBe(
      first.json().data.cycleCountFlaggedAt,
    );
  });

  it("never changes stock, updated_at or stock movements", async () => {
    const before = await readRow();

    await setFlag(inventoryId, { flagged: true });
    await setFlag(inventoryId, { flagged: false });

    const after = await readRow();
    expect(after).toMatchObject({
      onHand: before.onHand,
      reserved: before.reserved,
      damaged: before.damaged,
    });
    expect(after.updatedAt).toEqual(before.updatedAt);

    const movements = await db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId));
    expect(movements).toEqual([]);
  });

  it("returns 404 for an unknown row and 400 for bad input", async () => {
    const missing = await setFlag(crypto.randomUUID(), { flagged: true });
    expect(missing.statusCode).toBe(404);

    expect((await setFlag("not-a-uuid", { flagged: true })).statusCode).toBe(400);
    expect((await setFlag(inventoryId, { flagged: "yes" })).statusCode).toBe(400);
    expect((await setFlag(inventoryId, {})).statusCode).toBe(400);
  });
});
