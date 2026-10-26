import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

describe("contract: Warehouses", () => {
  const app = buildApp();
  const suffix = crypto.randomUUID().slice(0, 8);
  const missingId = "00000000-0000-4000-8000-000000000000";
  const warehousePayload = { code: `W-${suffix}`, name: `Warehouse ${suffix}` };
  let warehouseId: string;

  afterAll(async () => {
    expect(uncoveredOperations("Warehouses")).toEqual([]);
    await app.close();
  });

  it("POST /api/warehouses: created, invalid, duplicate code", async () => {
    const created = await app.inject({ method: "POST", url: "/api/warehouses", payload: warehousePayload });
    expect(created.statusCode).toBe(201);
    expectConformsToSpec(created, "post", "/api/warehouses");
    warehouseId = created.json().data.id;

    const invalid = await app.inject({ method: "POST", url: "/api/warehouses", payload: { code: "" } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/warehouses");

    const duplicate = await app.inject({ method: "POST", url: "/api/warehouses", payload: warehousePayload });
    expect(duplicate.statusCode).toBe(409);
    expectConformsToSpec(duplicate, "post", "/api/warehouses");
  });

  it("GET /api/warehouses", async () => {
    const response = await app.inject({ method: "GET", url: "/api/warehouses" });
    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/warehouses");
  });

  it("GET /api/warehouses/{id}: found, bad id, unknown id", async () => {
    for (const [id, status] of [[warehouseId, 200], ["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "GET", url: `/api/warehouses/${id}` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "get", "/api/warehouses/{id}");
    }
  });

  it("POST /api/warehouses/{id}/locations: created, invalid, unknown warehouse, duplicate code", async () => {
    const url = `/api/warehouses/${warehouseId}/locations`;
    const payload = { code: "A-01", name: "Aisle A" };

    const created = await app.inject({ method: "POST", url, payload });
    expect(created.statusCode).toBe(201);
    expectConformsToSpec(created, "post", "/api/warehouses/{id}/locations");

    const invalid = await app.inject({ method: "POST", url, payload: { name: "" } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/warehouses/{id}/locations");

    const unknown = await app.inject({ method: "POST", url: `/api/warehouses/${missingId}/locations`, payload });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "post", "/api/warehouses/{id}/locations");

    const duplicate = await app.inject({ method: "POST", url, payload });
    expect(duplicate.statusCode).toBe(409);
    expectConformsToSpec(duplicate, "post", "/api/warehouses/{id}/locations");
  });

  it("GET /api/warehouses/{id}/locations: found, bad id, unknown id", async () => {
    for (const [id, status] of [[warehouseId, 200], ["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "GET", url: `/api/warehouses/${id}/locations` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "get", "/api/warehouses/{id}/locations");
    }
  });
});
