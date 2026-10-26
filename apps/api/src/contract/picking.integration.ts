import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { expectConformsToSpec, uncoveredOperations } from "../openapi/contract.js";

describe("contract: Picking", () => {
  const app = buildApp();
  const suffix = crypto.randomUUID().slice(0, 8);
  const missingId = "00000000-0000-4000-8000-000000000000";
  let orderId: string;
  let pendingOrderId: string;
  let taskId: string;
  let itemId: string;
  let itemQuantity: number;

  const create = async (url: string, payload: object) => {
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(201);
    return response.json().data;
  };

  const newOrder = async (productId: string, orderNumber: string) =>
    (await create("/api/sales-orders", { orderNumber, customer: "Contract Co", items: [{ productId, orderedQuantity: 6 }] })).id;

  beforeAll(async () => {
    const warehouse = await create("/api/warehouses", { code: `W-${suffix}`, name: `Warehouse ${suffix}` });
    const location = await create(`/api/warehouses/${warehouse.id}/locations`, { code: "A-01", name: "Bin" });
    const productId = (await create("/api/products", { sku: `K-${suffix}`, name: `Pick item ${suffix}`, unitCost: 2 })).id;
    await create("/api/inventory/receive", { productId, locationId: location.id, quantity: 20 });

    orderId = await newOrder(productId, `SO-${suffix}`);
    await app.inject({ method: "POST", url: `/api/sales-orders/${orderId}/allocate` });
    pendingOrderId = await newOrder(productId, `SO-P-${suffix}`);
  });

  afterAll(async () => {
    expect(uncoveredOperations("Picking")).toEqual([]);
    await app.close();
  });

  it("POST /api/pick-tasks: created, invalid, order not allocated, unknown order", async () => {
    const created = await app.inject({ method: "POST", url: "/api/pick-tasks", payload: { salesOrderId: orderId } });
    expect(created.statusCode).toBe(201);
    expectConformsToSpec(created, "post", "/api/pick-tasks");
    taskId = created.json().data.id;

    const invalid = await app.inject({ method: "POST", url: "/api/pick-tasks", payload: {} });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/pick-tasks");

    const notAllocated = await app.inject({ method: "POST", url: "/api/pick-tasks", payload: { salesOrderId: pendingOrderId } });
    expect(notAllocated.statusCode).toBe(400);
    expectConformsToSpec(notAllocated, "post", "/api/pick-tasks");

    const unknown = await app.inject({ method: "POST", url: "/api/pick-tasks", payload: { salesOrderId: missingId } });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "post", "/api/pick-tasks");
  });

  it("GET /api/pick-tasks", async () => {
    const response = await app.inject({ method: "GET", url: "/api/pick-tasks" });
    expect(response.statusCode).toBe(200);
    expectConformsToSpec(response, "get", "/api/pick-tasks");
  });

  it("GET /api/pick-tasks/{id}: found, bad id, unknown id", async () => {
    for (const [id, status] of [[taskId, 200], ["nope", 400], [missingId, 404]] as const) {
      const response = await app.inject({ method: "GET", url: `/api/pick-tasks/${id}` });
      expect(response.statusCode).toBe(status);
      expectConformsToSpec(response, "get", "/api/pick-tasks/{id}");

      if (status === 200) {
        itemId = response.json().data.items[0].id;
        itemQuantity = response.json().data.items[0].quantity;
      }
    }
  });

  it("POST /api/pick-tasks/items/{itemId}/pick: partial, completing, too much, invalid, bad id, unknown id", async () => {
    const url = `/api/pick-tasks/items/${itemId}/pick`;

    const partial = await app.inject({ method: "POST", url, payload: { quantity: 1, reason: "contract" } });
    expect(partial.statusCode).toBe(201);
    expect(partial.json().data.taskStatus).toBe("IN_PROGRESS");
    expectConformsToSpec(partial, "post", "/api/pick-tasks/items/{itemId}/pick");

    const rest = await app.inject({ method: "POST", url, payload: { quantity: itemQuantity - 1 } });
    expect(rest.json().data.taskStatus).toBe("COMPLETED");
    expectConformsToSpec(rest, "post", "/api/pick-tasks/items/{itemId}/pick");

    const tooMuch = await app.inject({ method: "POST", url, payload: { quantity: 1 } });
    expect(tooMuch.statusCode).toBe(400);
    expectConformsToSpec(tooMuch, "post", "/api/pick-tasks/items/{itemId}/pick");

    const invalid = await app.inject({ method: "POST", url, payload: { quantity: 0 } });
    expect(invalid.statusCode).toBe(400);
    expectConformsToSpec(invalid, "post", "/api/pick-tasks/items/{itemId}/pick");

    const badId = await app.inject({ method: "POST", url: "/api/pick-tasks/items/nope/pick", payload: { quantity: 1 } });
    expect(badId.statusCode).toBe(400);
    expectConformsToSpec(badId, "post", "/api/pick-tasks/items/{itemId}/pick");

    const unknown = await app.inject({ method: "POST", url: `/api/pick-tasks/items/${missingId}/pick`, payload: { quantity: 1 } });
    expect(unknown.statusCode).toBe(404);
    expectConformsToSpec(unknown, "post", "/api/pick-tasks/items/{itemId}/pick");
  });
});
