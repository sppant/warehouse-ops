import { vi } from "vitest";
import { ApiRequestError, type WarehouseApiClient } from "../api-client.js";

// A fake API: each call to get() is answered by `respond(path, query)`.
export const fakeClient = (
  respond: (path: string, query: Record<string, unknown>) => unknown,
) => {
  const get = vi.fn(async (path: string, query: Record<string, unknown> = {}) =>
    respond(path, query),
  );

  return { client: { get } as unknown as WarehouseApiClient, get };
};

export const failingClient = (message = "The API returned an error (500). Try again later.") =>
  fakeClient(() => {
    throw new ApiRequestError(message);
  });

export const apiRow = (overrides: Record<string, unknown> = {}) => ({
  id: "inv-1",
  productId: "p-1",
  sku: "WIDGET-1",
  productName: "Widget",
  locationId: "11111111-1111-4111-8111-111111111111",
  locationCode: "A-01",
  warehouseCode: "MAIN",
  onHand: 20,
  reserved: 5,
  damaged: 0,
  available: 15,
  status: "IN_STOCK",
  lastMovementAt: "2026-01-02T03:04:05.000Z",
  cycleCountFlaggedAt: null,
  ...overrides,
});

export const overviewPage = (
  rows: unknown[],
  meta: { total?: number; totalPages?: number } = {},
) => ({
  data: rows,
  meta: {
    page: 1,
    pageSize: 100,
    total: meta.total ?? rows.length,
    totalPages: meta.totalPages ?? 1,
  },
});
