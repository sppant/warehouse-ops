import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { allFlagsOff } from "../config/flags.js";
import { inventoryRepository } from "../modules/inventory/inventory.repository.js";
import { productRepository } from "../modules/products/product.repository.js";
import { expectConformsToSpec } from "../openapi/contract.js";

vi.mock("../db/index.js", () => ({ db: {} }));

vi.mock("../modules/products/product.repository.js", () => ({
  productRepository: { findBySku: vi.fn() },
}));

vi.mock("../modules/inventory/inventory.repository.js", () => ({
  inventoryRepository: { findMovements: vi.fn() },
}));

const findBySku = vi.mocked(productRepository.findBySku);
const findMovements = vi.mocked(inventoryRepository.findMovements);

const PATH = "/api/items/{sku}/movements.csv";
const productId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";

const movement = (overrides: Record<string, unknown> = {}) => ({
  id: "33333333-3333-4333-8333-333333333333",
  productId,
  sku: "WID-1",
  productName: "Widget",
  locationId,
  locationCode: "A-01",
  type: "RECEIPT",
  quantity: 5,
  referenceType: null,
  referenceId: null,
  reason: null,
  createdAt: new Date("2026-03-01T10:00:00.000Z"),
  ...overrides,
});

describe("GET /api/items/{sku}/movements.csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findBySku.mockResolvedValue({ id: productId, sku: "WID-1" } as never);
    findMovements.mockResolvedValue([movement()] as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("flag off", () => {
    it("does not exist: 404 with Fastify's default body, and no lookup happens", async () => {
      const app = buildApp({ flags: allFlagsOff() });
      const response = await app.inject({ method: "GET", url: "/api/items/WID-1/movements.csv" });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ statusCode: 404, error: "Not Found" });
      expectConformsToSpec(response, "get", PATH);
      expect(findBySku).not.toHaveBeenCalled();

      await app.close();
    });

    it("is the default when FEATURE_FLAGS is not set", async () => {
      vi.stubEnv("FEATURE_FLAGS", "");
      const app = buildApp();
      const response = await app.inject({ method: "GET", url: "/api/items/WID-1/movements.csv" });

      expect(response.statusCode).toBe(404);

      await app.close();
    });
  });

  describe("flag on", () => {
    const build = () => buildApp({ flags: { movementsCsvExport: true } });

    it("is switched on by FEATURE_FLAGS=movementsCsvExport", async () => {
      vi.stubEnv("FEATURE_FLAGS", "movementsCsvExport");
      const app = buildApp();
      const response = await app.inject({ method: "GET", url: "/api/items/WID-1/movements.csv" });

      expect(response.statusCode).toBe(200);

      await app.close();
    });

    it("returns the movements as CSV that matches the spec", async () => {
      const app = build();
      const response = await app.inject({ method: "GET", url: "/api/items/WID-1/movements.csv" });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(response.headers["content-disposition"]).toBe('attachment; filename="movements-WID-1.csv"');
      expect(response.body).toBe(
        "createdAt,sku,productName,locationCode,type,quantity,referenceType,referenceId,reason\r\n" +
          "2026-03-01T10:00:00.000Z,WID-1,Widget,A-01,RECEIPT,5,,,\r\n",
      );
      expectConformsToSpec(response, "get", PATH);
      expect(findMovements).toHaveBeenCalledWith(productId, undefined);

      await app.close();
    });

    it("limits to one location when locationId is given", async () => {
      const app = build();
      const response = await app.inject({ method: "GET", url: `/api/items/WID-1/movements.csv?locationId=${locationId}` });

      expect(response.statusCode).toBe(200);
      expect(findMovements).toHaveBeenCalledWith(productId, locationId);

      await app.close();
    });

    it("returns only the header row for an item with no movements", async () => {
      findMovements.mockResolvedValue([]);
      const app = build();
      const response = await app.inject({ method: "GET", url: "/api/items/WID-1/movements.csv" });

      expect(response.statusCode).toBe(200);
      expect(response.body.split("\r\n")).toHaveLength(2);
      expectConformsToSpec(response, "get", PATH);

      await app.close();
    });

    it("keeps negative adjustments as numbers and neutralizes formulas in text", async () => {
      findMovements.mockResolvedValue([
        movement({ type: "ADJUSTMENT", quantity: -3, reason: '=HYPERLINK("http://x")' }),
      ] as never);
      const app = build();
      const response = await app.inject({ method: "GET", url: "/api/items/WID-1/movements.csv" });
      const row = response.body.split("\r\n")[1];

      expect(row).toContain(",ADJUSTMENT,-3,");
      expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);

      await app.close();
    });

    it("keeps the file name safe when the SKU has odd characters", async () => {
      const app = build();
      const response = await app.inject({ method: "GET", url: `/api/items/${encodeURIComponent('A"B/C')}/movements.csv` });

      expect(response.headers["content-disposition"]).toBe('attachment; filename="movements-A_B_C.csv"');

      await app.close();
    });

    it("rejects a locationId that is not a UUID with 400", async () => {
      const app = build();
      const response = await app.inject({ method: "GET", url: "/api/items/WID-1/movements.csv?locationId=nope" });

      expect(response.statusCode).toBe(400);
      expectConformsToSpec(response, "get", PATH);
      expect(findBySku).not.toHaveBeenCalled();

      await app.close();
    });

    it("rejects a blank SKU with 400", async () => {
      const app = build();
      const response = await app.inject({ method: "GET", url: "/api/items/%20%20/movements.csv" });

      expect(response.statusCode).toBe(400);
      expectConformsToSpec(response, "get", PATH);

      await app.close();
    });

    it("returns 404 for an unknown SKU", async () => {
      findBySku.mockResolvedValue(null);
      const app = build();
      const response = await app.inject({ method: "GET", url: "/api/items/NOPE/movements.csv" });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "No product with this SKU" });
      expectConformsToSpec(response, "get", PATH);

      await app.close();
    });
  });
});
