import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

describe("contract: Sales orders", () => {
  const app = buildApp();
  const suffix = crypto.randomUUID().slice(0, 8);
  const missingId = "00000000-0000-4000-8000-000000000000";
  let productId: string;
  let orderId: string;

  const create = async (url: string, payload: object) => {
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(201);
    return response.json().data;
  };

  const order = (orderNumber: string, quantity: number) =>
    app.inject({
      method: "POST",
      url: "/api/sales-orders",
      payload: { orderNumber, customer: "Contract Co", items: [{ productId, orderedQuantity: quantity }] },
    });

  beforeAll(async () => {
    const warehouse = await create("/api/warehouses", { code: `W-${suffix}`, name: `Warehouse ${suffix}` });
    const location = await create(`/api/warehouses/${warehouse.id}/locations`, { code: "A-01", name: "Bin" });
    productId = (await create("/api/products", { sku: `S-${suffix}`, name: `SO item ${suffix}`, unitCost: 2 })).id;
    await create("/api/inventory/receive", { productId, locationId: location.id, quantity: 10 });
  });

  afterAll(async () => {
    expect(uncoveredOperations("Sales orders")).toEqual([]);
    await app.close();
  });

  it("POST /api/sales-orders: created, invalid, unknown product, duplicate number", async () => {
    const created = await order(`SO-${suffix}`, 5);
    expect(created.statusCode).toBe(201);
    expectConformsToSpec(created, "post", "/api/sales-orders");
    orderId = created.json().data.id;

    const invalid = await app.inject({ method: "POST", url: "/api/sales-orders", payload: { items: [] } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/sales-orders");

    const unknown = await app.inject({
      method: "POST",
      url: "/api/sales-orders",
      payload: { orderNumber: `SO-X-${suffix}`, customer: "x", items: [{ productId: missingId, orderedQuantity: 1 }] },
    });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "post", "/api/sales-orders");

    const duplicate = await order(`SO-${suffix}`, 1);
    expect(duplicate.statusCode).toBe(409);
    expectConformsToSpec(duplicate, "post", "/api/sales-orders");
  });

  it("GET /api/sales-orders", async () => {
    const response = await app.inject({ method: "GET", url: "/api/sales-orders" });
    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/sales-orders");
  });

  it("GET /api/sales-orders/{id}: found, bad id, unknown id", async () => {
    for (const [id, status] of [[orderId, 200], ["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "GET", url: `/api/sales-orders/${id}` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "get", "/api/sales-orders/{id}");
    }
  });

  it("POST /api/sales-orders/{id}/allocate: allocated, repeated, too much stock needed, bad id, unknown id", async () => {
    const allocated = await app.inject({ method: "POST", url: `/api/sales-orders/${orderId}/allocate` });
    expect(allocated.statusCode).toBe(200);
    expectConformsToSpec(allocated, "post", "/api/sales-orders/{id}/allocate");

    const repeated = await app.inject({ method: "POST", url: `/api/sales-orders/${orderId}/allocate` });
    expect(repeated.statusCode).toBe(400);
    expectConformsToSpec(repeated, "post", "/api/sales-orders/{id}/allocate");

    const big = (await order(`SO-BIG-${suffix}`, 1000)).json().data.id;
    const insufficient = await app.inject({ method: "POST", url: `/api/sales-orders/${big}/allocate` });
    expect(insufficient.statusCode).toBe(400);
    expectConformsToSpec(insufficient, "post", "/api/sales-orders/{id}/allocate");

    for (const [id, status] of [["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "POST", url: `/api/sales-orders/${id}/allocate` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "post", "/api/sales-orders/{id}/allocate");
    }
  });

  it("POST pack and ship: wrong state, then the full path, plus bad and unknown ids", async () => {
    const tooEarlyPack = await app.inject({ method: "POST", url: `/api/sales-orders/${orderId}/pack` });
    expect(tooEarlyPack.statusCode).toBe(400);
    expectConformsToSpec(tooEarlyPack, "post", "/api/sales-orders/{id}/pack");

    const tooEarlyShip = await app.inject({ method: "POST", url: `/api/sales-orders/${orderId}/ship` });
    expect(tooEarlyShip.statusCode).toBe(400);
    expectConformsToSpec(tooEarlyShip, "post", "/api/sales-orders/{id}/ship");

    // Pick everything through the pick task endpoints to reach PICKED.
    const task = await create("/api/pick-tasks", { salesOrderId: orderId });
    const detail = await app.inject({ method: "GET", url: `/api/pick-tasks/${task.id}` });
    for (const item of detail.json().data.items) {
      await create(`/api/pick-tasks/items/${item.id}/pick`, { quantity: item.quantity });
    }

    const packed = await app.inject({ method: "POST", url: `/api/sales-orders/${orderId}/pack` });
    expect(packed.statusCode).toBe(200);
    expect(packed.json().data.status).toBe("PACKED");
    expectConformsToSpec(packed, "post", "/api/sales-orders/{id}/pack");

    const shipped = await app.inject({ method: "POST", url: `/api/sales-orders/${orderId}/ship` });
    expect(shipped.statusCode).toBe(200);
    expect(shipped.json().data.status).toBe("SHIPPED");
    expectConformsToSpec(shipped, "post", "/api/sales-orders/{id}/ship");

    for (const action of ["pack", "ship"]) {
      for (const [id, status] of [["nope", 400], [missingId, 404]] as const) {
        const response = await app.inject({ method: "POST", url: `/api/sales-orders/${id}/${action}` });
        expect(response.statusCode).toBe(status);
        expectConformsToSpec(response, "post", `/api/sales-orders/{id}/${action}`);
      }
    }
  });
});
