import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

// Real requests through the app and the test database; every response must
// match openapi.json.
describe("contract: Meta and Products", () => {
  const app = buildApp();
  const suffix = crypto.randomUUID().slice(0, 8);
  const missingId = "00000000-0000-4000-8000-000000000000";
  let productId: string;

  afterAll(async () => {
    expect(uncoveredOperations("Meta")).toEqual([]);
    expect(uncoveredOperations("Products")).toEqual([]);
    await app.close();
  });

  it("GET /health", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expectConformsToSpec(response, "get", "/health");
  });

  it("GET /api/openapi.json", async () => {
    const response = await app.inject({ method: "GET", url: "/api/openapi.json" });

    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/openapi.json");
  });

  it("POST /api/products: created, invalid", async () => {
    const payload = { sku: `C-${suffix}`, name: `Contract ${suffix}`, unitCost: 12.5 };

    const created = await app.inject({ method: "POST", url: "/api/products", payload });
    expect(created.statusCode).toBe(201);
    expectConformsToSpec(created, "post", "/api/products");
    productId = created.json().data.id;

    const invalid = await app.inject({ method: "POST", url: "/api/products", payload: { sku: "" } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/products");
  });

  it("GET /api/products, with and without search", async () => {
    const all = await app.inject({ method: "GET", url: "/api/products" });
    expect(all.statusCode).toBe(200);
    expectConformsToSpec(all, "get", "/api/products");

    const searched = await app.inject({ method: "GET", url: `/api/products?search=C-${suffix}` });
    expect(searched.json().data).toHaveLength(1);
    expectConformsToSpec(searched, "get", "/api/products");
  });

  it("GET /api/products/{id}: found, bad id, unknown id", async () => {
    const found = await app.inject({ method: "GET", url: `/api/products/${productId}` });
    expect(found.statusCode).toBe(200);
    expectConformsToSpec(found, "get", "/api/products/{id}");

    const bad = await app.inject({ method: "GET", url: "/api/products/not-a-uuid" });
    expect(bad.statusCode).toBe(400);
    expectConformsToSpec(bad, "get", "/api/products/{id}");

    const unknown = await app.inject({ method: "GET", url: `/api/products/${missingId}` });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "get", "/api/products/{id}");
  });

  it("PATCH /api/products/{id}: updated, invalid, unknown id", async () => {
    const url = `/api/products/${productId}`;

    const updated = await app.inject({ method: "PATCH", url, payload: { name: `Renamed ${suffix}`, isActive: false } });
    expect(updated.statusCode).toBe(200);
    expectConformsToSpec(updated, "patch", "/api/products/{id}");

    const invalid = await app.inject({ method: "PATCH", url, payload: { unitCost: -1 } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "patch", "/api/products/{id}");

    const unknown = await app.inject({ method: "PATCH", url: `/api/products/${missingId}`, payload: { name: "x" } });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "patch", "/api/products/{id}");
  });
});
