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

type Summary = {
  stockByLocation: Array<{
    locationId: string;
    onHand: number;
    available: number;
  }>;
  movementsPerDay: Array<{ date: string; count: number; volume: number }>;
  topItems: Array<{
    productId: string;
    sku: string;
    movementCount: number;
    volume: number;
  }>;
};

describe("GET /api/inventory/summary integration", () => {
  const app = buildApp();
  const tag = crypto.randomUUID().slice(0, 8);
  const day = 24 * 60 * 60 * 1000;
  const utcDate = (offsetDays: number) =>
    new Date(Date.now() - offsetDays * day).toISOString().slice(0, 10);

  let warehouseId: string;
  let locAId: string;
  let locBId: string;
  let hotProductId: string;
  let staleProductId: string;
  let baseline: Summary;
  const productIds: string[] = [];

  const fetchSummary = async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/inventory/summary",
    });
    expect(response.statusCode).toBe(200);
    return (response.json() as { data: Summary }).data;
  };

  const bucket = (summary: Summary, date: string) =>
    summary.movementsPerDay.find((entry) => entry.date === date)!;

  beforeAll(async () => {
    const [warehouse] = await db
      .insert(warehouses)
      .values({ code: `SM-${tag}`, name: "Summary Test Warehouse" })
      .returning({ id: warehouses.id });
    warehouseId = warehouse!.id;

    const [locA, locB] = await db
      .insert(locations)
      .values([
        { warehouseId, code: `SMA-${tag}`, name: "Summary A" },
        { warehouseId, code: `SMB-${tag}`, name: "Summary B" },
      ])
      .returning({ id: locations.id });
    locAId = locA!.id;
    locBId = locB!.id;

    const [hot, stale] = await db
      .insert(products)
      .values([
        { sku: `SM-${tag}-HOT`, name: "Hot item", unitCost: "1.00" },
        { sku: `SM-${tag}-OLD`, name: "Stale item", unitCost: "1.00" },
      ])
      .returning({ id: products.id });
    hotProductId = hot!.id;
    staleProductId = stale!.id;
    productIds.push(hotProductId, staleProductId);

    // Very large on-hand totals keep both locations inside the top-20 list
    // even if other data is present in the database.
    await db.insert(inventory).values([
      { productId: hotProductId, locationId: locAId, onHand: 9_000_000, reserved: 100, damaged: 50 },
      { productId: staleProductId, locationId: locAId, onHand: 1_000_000 },
      { productId: hotProductId, locationId: locBId, onHand: 8_000_000 },
    ]);

    baseline = await fetchSummary();

    await db.insert(stockMovements).values([
      // Inside the window: two movements today, one 5 days ago.
      { productId: hotProductId, locationId: locAId, type: "PICK", quantity: 7_000_000 },
      { productId: hotProductId, locationId: locAId, type: "ADJUSTMENT", quantity: -3 },
      {
        productId: hotProductId,
        locationId: locAId,
        type: "RECEIPT",
        quantity: 10,
        createdAt: new Date(Date.now() - 5 * day),
      },
      // Outside the 30-day window: must not count anywhere.
      {
        productId: staleProductId,
        locationId: locAId,
        type: "RECEIPT",
        quantity: 90_000_000,
        createdAt: new Date(Date.now() - 40 * day),
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

  it("sums on-hand and available stock per location", async () => {
    const summary = await fetchSummary();
    const locA = summary.stockByLocation.find((row) => row.locationId === locAId);
    const locB = summary.stockByLocation.find((row) => row.locationId === locBId);

    // A: 9,000,000 + 1,000,000 on hand; only the first row has 100 reserved + 50 damaged.
    expect(locA).toMatchObject({ onHand: 10_000_000, available: 10_000_000 - 150 });
    expect(locB).toMatchObject({ onHand: 8_000_000, available: 8_000_000 });

    const onHand = summary.stockByLocation.map((row) => row.onHand);
    expect(onHand).toEqual([...onHand].sort((a, b) => b - a));
    expect(summary.stockByLocation.length).toBeLessThanOrEqual(20);
  });

  it("returns exactly 30 consecutive days ending today (UTC), zero-filled", async () => {
    const summary = await fetchSummary();
    const dates = summary.movementsPerDay.map((entry) => entry.date);

    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe(utcDate(29));
    expect(dates[29]).toBe(utcDate(0));
    expect(new Set(dates).size).toBe(30);
    expect(
      summary.movementsPerDay.every((entry) => entry.count >= 0 && entry.volume >= 0),
    ).toBe(true);
  });

  it("counts movements per day and measures volume by absolute quantity", async () => {
    const summary = await fetchSummary();
    const today = utcDate(0);
    const fiveDaysAgo = utcDate(5);

    // The rows inserted by this test are the only difference from the baseline.
    expect(bucket(summary, today).count - bucket(baseline, today).count).toBe(2);
    expect(bucket(summary, today).volume - bucket(baseline, today).volume).toBe(7_000_003);
    expect(bucket(summary, fiveDaysAgo).count - bucket(baseline, fiveDaysAgo).count).toBe(1);
    expect(bucket(summary, fiveDaysAgo).volume - bucket(baseline, fiveDaysAgo).volume).toBe(10);
  });

  it("ranks the top items by movement volume inside the window only", async () => {
    const summary = await fetchSummary();

    expect(summary.topItems.length).toBeLessThanOrEqual(10);

    const [first] = summary.topItems;
    expect(first).toMatchObject({
      productId: hotProductId,
      sku: `SM-${tag}-HOT`,
      movementCount: 3,
      volume: 7_000_013,
    });

    const volumes = summary.topItems.map((item) => item.volume);
    expect(volumes).toEqual([...volumes].sort((a, b) => b - a));

    // The 90M-unit movement is 40 days old, so the stale product is excluded.
    expect(summary.topItems.some((item) => item.productId === staleProductId)).toBe(false);
  });
});
