import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

describe("contract: Purchase orders", () => {
  const app = buildApp();
  const suffix = crypto.randomUUID().slice(0, 8);
  const missingId = "00000000-0000-4000-8000-000000000000";
  let productId: string;
  let locationId: string;
  let orderId: string;
  let itemId: string;

  const create = async (url: string, payload: object) => {
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(201);
    return response.json().data;
  };

  beforeAll(async () => {
    const warehouse = await create("/api/warehouses", { code: `W-${suffix}`, name: `Warehouse ${suffix}` });
    locationId = (await create(`/api/warehouses/${warehouse.id}/locations`, { code: "A-01", name: "Bin" })).id;
    productId = (await create("/api/products", { sku: `P-${suffix}`, name: `PO item ${suffix}`, unitCost: 4 })).id;
  });

  afterAll(async () => {
    expect(uncoveredOperations("Purchase orders")).toEqual([]);
    await app.close();
  });

  it("POST /api/purchase-orders: created, invalid, unknown product, duplicate number", async () => {
    const payload = {
      orderNumber: `PO-${suffix}`,
      supplier: "Acme",
      expectedAt: "2026-12-01T00:00:00.000Z",
      items: [{ productId, orderedQuantity: 10, unitCost: 4 }],
    };

    const created = await app.inject({ method: "POST", url: "/api/purchase-orders", payload });
    expect(created.statusCode).toBe(201);
    expectConformsToSpec(created, "post", "/api/purchase-orders");
    orderId = created.json().data.id;
    itemId = created.json().data.items[0].id;

    const invalid = await app.inject({ method: "POST", url: "/api/purchase-orders", payload: { items: [] } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/purchase-orders");

    const unknown = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      payload: { ...payload, orderNumber: `PO-X-${suffix}`, items: [{ productId: missingId, orderedQuantity: 1, unitCost: 1 }] },
    });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "post", "/api/purchase-orders");

    const duplicate = await app.inject({ method: "POST", url: "/api/purchase-orders", payload });
    expect(duplicate.statusCode).toBe(409);
    expectConformsToSpec(duplicate, "post", "/api/purchase-orders");
  });

  it("GET /api/purchase-orders", async () => {
    const response = await app.inject({ method: "GET", url: "/api/purchase-orders" });
    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/purchase-orders");
  });

  it("GET /api/purchase-orders/{id}: found, bad id, unknown id", async () => {
    for (const [id, status] of [[orderId, 200], ["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "GET", url: `/api/purchase-orders/${id}` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "get", "/api/purchase-orders/{id}");
    }
  });

  it("PATCH /api/purchase-orders/{id}/status: updated, invalid, unknown id", async () => {
    const updated = await app.inject({ method: "PATCH", url: `/api/purchase-orders/${orderId}/status`, payload: { status: "ORDERED" } });
    expect(updated.statusCode).toBe(200);
    expectConformsToSpec(updated, "patch", "/api/purchase-orders/{id}/status");

    const invalid = await app.inject({ method: "PATCH", url: `/api/purchase-orders/${orderId}/status`, payload: { status: "LOST" } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "patch", "/api/purchase-orders/{id}/status");

    const unknown = await app.inject({ method: "PATCH", url: `/api/purchase-orders/${missingId}/status`, payload: { status: "ORDERED" } });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "patch", "/api/purchase-orders/{id}/status");
  });

  it("POST /api/purchase-orders/items/{itemId}/receive: partial, over-receive, invalid, unknown", async () => {
    const url = `/api/purchase-orders/items/${itemId}/receive`;

    const partial = await app.inject({ method: "POST", url, payload: { locationId, quantity: 4, reason: "contract" } });
    expect(partial.statusCode).toBe(201);
    expect(partial.json().data.status).toBe("PARTIALLY_RECEIVED");
    expectConformsToSpec(partial, "post", "/api/purchase-orders/items/{itemId}/receive");

    const complete = await app.inject({ method: "POST", url, payload: { locationId, quantity: 6 } });
    expect(complete.json().data.status).toBe("RECEIVED");
    expectConformsToSpec(complete, "post", "/api/purchase-orders/items/{itemId}/receive");

    const tooMuch = await app.inject({ method: "POST", url, payload: { locationId, quantity: 1 } });
    expect(tooMuch.statusCode).toBe(400);
    expectConformsToSpec(tooMuch, "post", "/api/purchase-orders/items/{itemId}/receive");

    const invalid = await app.inject({ method: "POST", url, payload: { quantity: -1 } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/purchase-orders/items/{itemId}/receive");

    const unknown = await app.inject({
      method: "POST",
      url: `/api/purchase-orders/items/${missingId}/receive`,
      payload: { locationId, quantity: 1 },
    });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "post", "/api/purchase-orders/items/{itemId}/receive");
  });
});
