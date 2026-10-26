import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

describe("contract: Inventory", () => {
  const app = buildApp();
  const suffix = crypto.randomUUID().slice(0, 8);
  const missingId = "00000000-0000-4000-8000-000000000000";
  let productId: string;
  let locationId: string;
  let inventoryId: string;

  const post = async (url: string, payload: object) => {
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(201);
    return response.json().data;
  };

  beforeAll(async () => {
    const warehouse = await post("/api/warehouses", { code: `W-${suffix}`, name: `Warehouse ${suffix}` });
    locationId = (await post(`/api/warehouses/${warehouse.id}/locations`, { code: `L-${suffix}`, name: "Bin" })).id;
    productId = (await post("/api/products", { sku: `I-${suffix}`, name: `Inventory ${suffix}`, unitCost: 3 })).id;
  });

  afterAll(async () => {
    expect(uncoveredOperations("Inventory")).toEqual([]);
    await app.close();
  });

  it("POST /api/inventory/receive: created, invalid, unknown product, unknown location", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/inventory/receive",
      payload: { productId, locationId, quantity: 20, reason: "contract test" },
    });
    expect(created.statusCode).toBe(201);
    expectConformsToSpec(created, "post", "/api/inventory/receive");
    inventoryId = created.json().data.id;

    const invalid = await app.inject({ method: "POST", url: "/api/inventory/receive", payload: { quantity: 0 } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/inventory/receive");

    for (const payload of [
      { productId: missingId, locationId, quantity: 1 },
      { productId, locationId: missingId, quantity: 1 },
    ]) {
      const unknown = await app.inject({ method: "POST", url: "/api/inventory/receive", payload });
      expect(unknown.statusCode).toBe(404);
      expectConformsToSpec(unknown, "post", "/api/inventory/receive");
    }
  });

  it("GET /api/inventory: all, searched, invalid", async () => {
    const searched = await app.inject({ method: "GET", url: `/api/inventory?search=I-${suffix}` });
    expect(searched.json().data).toHaveLength(1);
    expectConformsToSpec(searched, "get", "/api/inventory");

    const all = await app.inject({ method: "GET", url: "/api/inventory" });
    expectConformsToSpec(all, "get", "/api/inventory");

    const invalid = await app.inject({ method: "GET", url: `/api/inventory?search=${"x".repeat(201)}` });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "get", "/api/inventory");
  });

  it("GET /api/inventory/overview: default, filtered, invalid", async () => {
    const defaults = await app.inject({ method: "GET", url: "/api/inventory/overview" });
    expect(defaults.statusCode).toBe(200);
    expectConformsToSpec(defaults, "get", "/api/inventory/overview");

    const filtered = await app.inject({
      method: "GET",
      url: `/api/inventory/overview?search=I-${suffix}&status=IN_STOCK&locationId=${locationId}&sortBy=available&sortDir=desc&page=1&pageSize=5`,
    });
    expect(filtered.json().data).toHaveLength(1);
    expectConformsToSpec(filtered, "get", "/api/inventory/overview");

    const invalid = await app.inject({ method: "GET", url: "/api/inventory/overview?pageSize=1000" });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "get", "/api/inventory/overview");
  });

  it("GET /api/inventory/summary", async () => {
    const response = await app.inject({ method: "GET", url: "/api/inventory/summary" });
    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/inventory/summary");
  });

  it("GET /api/inventory/movements: all, filtered, invalid", async () => {
    const filtered = await app.inject({
      method: "GET",
      url: `/api/inventory/movements?productId=${productId}&locationId=${locationId}`,
    });
    expect(filtered.json().data).toHaveLength(1);
    expectConformsToSpec(filtered, "get", "/api/inventory/movements");

    const all = await app.inject({ method: "GET", url: "/api/inventory/movements" });
    expectConformsToSpec(all, "get", "/api/inventory/movements");

    const invalid = await app.inject({ method: "GET", url: "/api/inventory/movements?productId=nope" });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "get", "/api/inventory/movements");
  });

  it("PUT /api/inventory/{id}/cycle-count-flag: flag, unflag, invalid, unknown", async () => {
    const url = `/api/inventory/${inventoryId}/cycle-count-flag`;

    for (const flagged of [true, false]) {
      const response = await app.inject({ method: "PUT", url, payload: { flagged } });
      expect(response.statusCode).toBe(200);
      expectConformsToSpec(response, "put", "/api/inventory/{id}/cycle-count-flag");
    }

    const invalid = await app.inject({ method: "PUT", url, payload: { flagged: "yes" } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "put", "/api/inventory/{id}/cycle-count-flag");

    const unknown = await app.inject({
      method: "PUT",
      url: `/api/inventory/${missingId}/cycle-count-flag`,
      payload: { flagged: true },
    });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "put", "/api/inventory/{id}/cycle-count-flag");
  });
});
