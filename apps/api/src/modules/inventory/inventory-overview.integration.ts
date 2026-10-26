import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { buildApp } from "../../app.js";
import { db } from "../../db/index.js";
import {
  inventory,
  locations,
  products,
  stockMovements,
  warehouses,
} from "../../db/schema.js";

type OverviewItem = {
  sku: string;
  productName: string;
  locationCode: string;
  onHand: number;
  available: number;
  status: string;
  lastMovementAt: string | null;
};

type Overview = {
  data: OverviewItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

describe("GET /api/inventory/overview integration", () => {
  const app = buildApp();
  const tag = crypto.randomUUID().slice(0, 8);
  const day = 24 * 60 * 60 * 1000;
  let warehouseId: string;
  let locAId: string;
  let locBId: string;
  const productIds: string[] = [];
  const newestMovement = new Date(Date.now() - 2 * day);

  const overview = async (params: Record<string, string | number>) => {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString();
    const response = await app.inject({
      method: "GET",
      url: `/api/inventory/overview?${query}`,
    });
    return { status: response.statusCode, body: response.json() as Overview };
  };

  const skus = (result: { body: Overview }) =>
    result.body.data.map((item) => item.sku);

  beforeAll(async () => {
    const [warehouse] = await db
      .insert(warehouses)
      .values({ code: `OV-${tag}`, name: "Overview Test Warehouse" })
      .returning({ id: warehouses.id });
    warehouseId = warehouse!.id;

    const [locA, locB] = await db
      .insert(locations)
      .values([
        { warehouseId, code: `OVA-${tag}`, name: "Overview A" },
        { warehouseId, code: `OVB-${tag}`, name: "Overview B" },
      ])
      .returning({ id: locations.id });
    locAId = locA!.id;
    locBId = locB!.id;

    // Names are chosen to exercise search: P3 and P4 differ only by the
    // character after "100", to prove % is matched literally, not as a wildcard.
    const created = await db
      .insert(products)
      .values([
        { sku: `OV-${tag}-1`, name: "Alpha Widget", unitCost: "1.00" },
        { sku: `OV-${tag}-2`, name: "Bravo Widget", unitCost: "1.00" },
        { sku: `OV-${tag}-3`, name: "100% Cotton", unitCost: "1.00" },
        { sku: `OV-${tag}-4`, name: "100X Cotton", unitCost: "1.00" },
        { sku: `OV-${tag}-5`, name: "Echo Gadget", unitCost: "1.00" },
        { sku: `OV-${tag}-6`, name: "Foxtrot Gadget", unitCost: "1.00" },
      ])
      .returning({ id: products.id, sku: products.sku });
    const bySku = Object.fromEntries(created.map((p) => [p.sku, p.id]));
    productIds.push(...created.map((p) => p.id));
    const id = (n: number) => bySku[`OV-${tag}-${n}`]!;

    // Location A: available 80 / 10 / 11 / 0 / 3 around the low-stock boundary of 10.
    await db.insert(inventory).values([
      { productId: id(1), locationId: locAId, onHand: 100, reserved: 20 },
      { productId: id(2), locationId: locAId, onHand: 10 },
      { productId: id(3), locationId: locAId, onHand: 11 },
      { productId: id(4), locationId: locAId, onHand: 5, reserved: 5 },
      { productId: id(5), locationId: locAId, onHand: 8, reserved: 2, damaged: 3 },
      { productId: id(1), locationId: locBId, onHand: 50 },
      { productId: id(6), locationId: locBId, onHand: 0 },
    ]);

    // P1 @ A has two movements; the overview must report the newest one.
    await db.insert(stockMovements).values([
      {
        productId: id(1),
        locationId: locAId,
        type: "RECEIPT",
        quantity: 100,
        createdAt: new Date(Date.now() - 10 * day),
      },
      {
        productId: id(1),
        locationId: locAId,
        type: "PICK",
        quantity: 20,
        createdAt: newestMovement,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(stockMovements).where(inArray(stockMovements.productId, productIds));
    await db.delete(inventory).where(inArray(inventory.productId, productIds));
    await db.delete(products).where(inArray(products.id, productIds));
    await db.delete(locations).where(eq(locations.warehouseId, warehouseId));
    await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    await app.close();
  });

  it("returns computed stock, status and the newest movement date", async () => {
    const result = await overview({ locationId: locAId, sortBy: "sku" });

    expect(result.status).toBe(200);
    expect(result.body.meta).toMatchObject({ page: 1, total: 5, totalPages: 1 });

    const first = result.body.data[0]!;
    expect(first).toMatchObject({
      sku: `OV-${tag}-1`,
      onHand: 100,
      available: 80,
      status: "IN_STOCK",
      locationCode: `OVA-${tag}`,
    });
    expect(first.lastMovementAt).toBe(newestMovement.toISOString());

    // No movements recorded for P2 @ A.
    expect(result.body.data[1]!.lastMovementAt).toBeNull();
  });

  it("filters by location", async () => {
    const result = await overview({ locationId: locBId, sortBy: "sku" });

    expect(skus(result)).toEqual([`OV-${tag}-1`, `OV-${tag}-6`]);
    expect(result.body.meta.total).toBe(2);
  });

  it("filters by stock status, including the boundaries", async () => {
    const out = await overview({ locationId: locAId, status: "OUT_OF_STOCK" });
    expect(skus(out)).toEqual([`OV-${tag}-4`]);

    // available 10 (P2) and 3 (P5) are low; 11 (P3) is already in stock.
    const low = await overview({ locationId: locAId, status: "LOW_STOCK", sortBy: "sku" });
    expect(skus(low)).toEqual([`OV-${tag}-2`, `OV-${tag}-5`]);

    const inStock = await overview({ locationId: locAId, status: "IN_STOCK", sortBy: "sku" });
    expect(skus(inStock)).toEqual([`OV-${tag}-1`, `OV-${tag}-3`]);
  });

  it("combines the location and status filters", async () => {
    const result = await overview({ locationId: locBId, status: "OUT_OF_STOCK" });

    expect(skus(result)).toEqual([`OV-${tag}-6`]);
    expect(result.body.meta.total).toBe(1);
  });

  it("searches SKU, product name and location code, case-insensitively", async () => {
    const bySku = await overview({ search: `ov-${tag}-5` });
    expect(skus(bySku)).toEqual([`OV-${tag}-5`]);

    const byName = await overview({ search: "foxtrot", locationId: locBId });
    expect(skus(byName)).toEqual([`OV-${tag}-6`]);

    const byLocation = await overview({ search: `ova-${tag}` });
    expect(byLocation.body.meta.total).toBe(5);
  });

  it("treats LIKE wildcards in the search as literal text", async () => {
    // Unescaped, "100%" would also match "100X Cotton".
    const result = await overview({ search: "100%", locationId: locAId });

    expect(skus(result)).toEqual([`OV-${tag}-3`]);
  });

  it("sorts by available stock in both directions", async () => {
    const asc = await overview({ locationId: locAId, sortBy: "available", sortDir: "asc" });
    expect(asc.body.data.map((item) => item.available)).toEqual([0, 3, 10, 11, 80]);

    const desc = await overview({ locationId: locAId, sortBy: "available", sortDir: "desc" });
    expect(desc.body.data.map((item) => item.available)).toEqual([80, 11, 10, 3, 0]);
  });

  it("sorts by product name and by last movement with nulls last", async () => {
    const byName = await overview({ locationId: locAId, sortBy: "product", sortDir: "desc" });
    expect(byName.body.data.map((item) => item.productName)).toEqual([
      "Echo Gadget",
      "Bravo Widget",
      "Alpha Widget",
      "100X Cotton",
      "100% Cotton",
    ]);

    for (const sortDir of ["asc", "desc"]) {
      const byMovement = await overview({ locationId: locAId, sortBy: "lastMovement", sortDir });
      expect(byMovement.body.data[0]!.sku).toBe(`OV-${tag}-1`);
      expect(byMovement.body.data.slice(1).every((item) => item.lastMovementAt === null)).toBe(true);
    }
  });

  it("paginates without overlap and reports totals", async () => {
    const seen: string[] = [];

    for (const page of [1, 2, 3]) {
      const result = await overview({ locationId: locAId, sortBy: "sku", pageSize: 2, page });
      expect(result.body.meta).toMatchObject({ page, pageSize: 2, total: 5, totalPages: 3 });
      seen.push(...skus(result));
    }

    expect(seen).toEqual([1, 2, 3, 4, 5].map((n) => `OV-${tag}-${n}`));

    const beyond = await overview({ locationId: locAId, pageSize: 2, page: 4 });
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta.total).toBe(5);
  });

  it("returns an empty page, not an error, when nothing matches", async () => {
    const result = await overview({ search: `no-such-item-${tag}` });

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual([]);
    expect(result.body.meta).toMatchObject({ total: 0, totalPages: 1 });
  });

  it("rejects invalid query parameters with a 400", async () => {
    const invalid: Array<Record<string, string | number>> = [
      { page: 0 },
      { pageSize: 101 },
      { sortBy: "id; drop table inventory" },
      { sortDir: "sideways" },
      { status: "SOMETIMES" },
      { locationId: "not-a-uuid" },
    ];

    for (const params of invalid) {
      const result = await overview(params);
      expect(result.status, JSON.stringify(params)).toBe(400);
    }
  });
});
