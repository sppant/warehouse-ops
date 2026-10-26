import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

// The same endpoint against the real database, with the flag on.
describe("contract: Items", () => {
  const app = buildApp({ flags: { movementsCsvExport: true } });
  const suffix = crypto.randomUUID().slice(0, 8);
  const sku = `CSV-${suffix}`;
  let locationId: string;
  let otherLocationId: string;

  const create = async (url: string, payload: object) => {
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(201);
    return response.json().data;
  };

  beforeAll(async () => {
    const warehouse = await create("/api/warehouses", { code: `W-${suffix}`, name: `Warehouse ${suffix}` });
    locationId = (await create(`/api/warehouses/${warehouse.id}/locations`, { code: "A-01", name: "Bin A" })).id;
    otherLocationId = (await create(`/api/warehouses/${warehouse.id}/locations`, { code: "B-01", name: "Bin B" })).id;
    const productId = (await create("/api/products", { sku, name: `CSV item ${suffix}`, unitCost: 2 })).id;
    await create("/api/inventory/receive", { productId, locationId, quantity: 10, reason: "first, with comma" });
    await create("/api/inventory/receive", { productId, locationId: otherLocationId, quantity: 4 });
  });

  afterAll(async () => {
    expect(uncoveredOperations("Items")).toEqual([]);
    await app.close();
  });

  it("exports every movement of the item, newest first", async () => {
    const response = await app.inject({ method: "GET", url: `/api/items/${sku}/movements.csv` });

    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/items/{sku}/movements.csv");

    const lines = response.body.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(",B-01,RECEIPT,4,");
    expect(lines[2]).toContain(',A-01,RECEIPT,10,,,"first, with comma"');
  });

  it("limits to one location", async () => {
    const response = await app.inject({ method: "GET", url: `/api/items/${sku}/movements.csv?locationId=${otherLocationId}` });

    expect(response.statusCode).toBe(200);
    expect(response.body.trimEnd().split("\r\n")).toHaveLength(2);
    expectConformsToSpec(response, "get", "/api/items/{sku}/movements.csv");
  });

  it("returns 404 for an unknown SKU", async () => {
    const response = await app.inject({ method: "GET", url: `/api/items/NOPE-${suffix}/movements.csv` });

    expect(response.statusCode).toBe(404);
    expectConformsToSpec(response, "get", "/api/items/{sku}/movements.csv");
  });

  it("returns 400 for invalid input", async () => {
    const response = await app.inject({ method: "GET", url: `/api/items/${sku}/movements.csv?locationId=nope` });

    expect(response.statusCode).toBe(400);
    expectConformsToSpec(response, "get", "/api/items/{sku}/movements.csv");
  });

  it("is a 404 when the flag is off, with a real database behind it", async () => {
    const off = buildApp();
    const response = await off.inject({ method: "GET", url: `/api/items/${sku}/movements.csv` });

    expect(response.statusCode).toBe(404);
    expectConformsToSpec(response, "get", "/api/items/{sku}/movements.csv");

    await off.close();
  });
});
