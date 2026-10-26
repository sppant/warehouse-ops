import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

describe("contract: Cycle counts", () => {
  const app = buildApp();
  const suffix = crypto.randomUUID().slice(0, 8);
  const missingId = "00000000-0000-4000-8000-000000000000";
  let productId: string;
  let locationId: string;
  let countId: string;

  const create = async (url: string, payload: object) => {
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(201);
    return response.json().data;
  };

  const record = (countedQuantity: number) =>
    app.inject({ method: "POST", url: "/api/cycle-counts", payload: { productId, locationId, countedQuantity, reason: "contract" } });

  beforeAll(async () => {
    const warehouse = await create("/api/warehouses", { code: `W-${suffix}`, name: `Warehouse ${suffix}` });
    locationId = (await create(`/api/warehouses/${warehouse.id}/locations`, { code: "A-01", name: "Bin" })).id;
    productId = (await create("/api/products", { sku: `C-${suffix}`, name: `Count item ${suffix}`, unitCost: 2 })).id;
    await create("/api/inventory/receive", { productId, locationId, quantity: 10 });
  });

  afterAll(async () => {
    expect(uncoveredOperations("Cycle counts")).toEqual([]);
    await app.close();
  });

  it("POST /api/cycle-counts: recorded, invalid, unknown product, unknown location", async () => {
    const recorded = await record(8);
    expect(recorded.statusCode).toBe(201);
    expectConformsToSpec(recorded, "post", "/api/cycle-counts");
    countId = recorded.json().data.id;

    const invalid = await app.inject({ method: "POST", url: "/api/cycle-counts", payload: { countedQuantity: -1 } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/cycle-counts");

    for (const payload of [
      { productId: missingId, locationId, countedQuantity: 1 },
      { productId, locationId: missingId, countedQuantity: 1 },
    ]) {
      const unknown = await app.inject({ method: "POST", url: "/api/cycle-counts", payload });
      expect(unknown.statusCode).toBe(404);
      expectConformsToSpec(unknown, "post", "/api/cycle-counts");
    }
  });

  it("GET /api/cycle-counts", async () => {
    const response = await app.inject({ method: "GET", url: "/api/cycle-counts" });
    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/cycle-counts");
  });

  it("GET /api/cycle-counts/{id}: found, bad id, unknown id", async () => {
    for (const [id, status] of [[countId, 200], ["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "GET", url: `/api/cycle-counts/${id}` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "get", "/api/cycle-counts/{id}");
    }
  });

  it("POST approve: approved, repeated, bad id, unknown id", async () => {
    const approved = await app.inject({ method: "POST", url: `/api/cycle-counts/${countId}/approve` });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.status).toBe("APPROVED");
    expectConformsToSpec(approved, "post", "/api/cycle-counts/{id}/approve");

    const repeated = await app.inject({ method: "POST", url: `/api/cycle-counts/${countId}/approve` });
    expect(repeated.statusCode).toBe(400);
    expectConformsToSpec(repeated, "post", "/api/cycle-counts/{id}/approve");

    for (const [id, status] of [["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "POST", url: `/api/cycle-counts/${id}/approve` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "post", "/api/cycle-counts/{id}/approve");
    }
  });

  it("POST reject: rejected, repeated, bad id, unknown id", async () => {
    const pending = (await record(10)).json().data.id;

    const rejected = await app.inject({ method: "POST", url: `/api/cycle-counts/${pending}/reject` });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.status).toBe("REJECTED");
    expectConformsToSpec(rejected, "post", "/api/cycle-counts/{id}/reject");

    const repeated = await app.inject({ method: "POST", url: `/api/cycle-counts/${pending}/reject` });
    expect(repeated.statusCode).toBe(400);
    expectConformsToSpec(repeated, "post", "/api/cycle-counts/{id}/reject");

    for (const [id, status] of [["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "POST", url: `/api/cycle-counts/${id}/reject` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "post", "/api/cycle-counts/{id}/reject");
    }
  });
});
