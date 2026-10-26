import { describe, expect, it } from "vitest";
import { listLowStock, listLowStockInput, listLowStockOutput } from "./list-low-stock.js";
import { apiRow, failingClient, fakeClient, overviewPage } from "./test-helpers.js";

const row = (sku: string, available: number) => apiRow({ sku, available });

describe("list_low_stock", () => {
  it("asks the API for LOW_STOCK rows by default", async () => {
    const { client, get } = fakeClient(() =>
      overviewPage([row("A", 2), row("B", 7)]),
    );

    const result = await listLowStock(client, listLowStockInput.parse({}));

    const output = listLowStockOutput.parse(result.structuredContent);
    expect(output.items.map((item) => item.sku)).toEqual(["A", "B"]);
    expect(output.truncated).toBe(false);
    expect(get.mock.calls[0]![1]).toMatchObject({ status: "LOW_STOCK", sortBy: "available", sortDir: "asc" });
  });

  it("stops at the first row above a custom threshold", async () => {
    const { client, get } = fakeClient(() =>
      overviewPage([row("A", 5), row("B", 30), row("C", 50)], { totalPages: 3 }),
    );

    const result = await listLowStock(client, listLowStockInput.parse({ threshold: 30 }));

    expect(result.structuredContent!.items).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]![1]).not.toHaveProperty("status", "LOW_STOCK");
  });

  it("includes out-of-stock rows only when asked", async () => {
    const rows = [row("OUT", 0), row("LOW", 3), row("FINE", 40)];

    const without = await listLowStock(
      fakeClient(() => overviewPage(rows)).client,
      listLowStockInput.parse({ threshold: 20 }),
    );
    const withOut = await listLowStock(
      fakeClient(() => overviewPage(rows)).client,
      listLowStockInput.parse({ threshold: 20, includeOutOfStock: true }),
    );

    expect((without.structuredContent!.items as { sku: string }[]).map((i) => i.sku)).toEqual(["LOW"]);
    expect((withOut.structuredContent!.items as { sku: string }[]).map((i) => i.sku)).toEqual(["OUT", "LOW"]);
  });

  it("truncates at the limit", async () => {
    const { client } = fakeClient(() => overviewPage([row("A", 1), row("B", 2), row("C", 3)]));

    const result = await listLowStock(client, listLowStockInput.parse({ limit: 2 }));

    expect(result.structuredContent).toMatchObject({ truncated: true });
    expect(result.structuredContent!.items).toHaveLength(2);
  });

  it.each([[{ threshold: -1 }], [{ threshold: 1.5 }], [{ limit: 0 }], [{ limit: 101 }], [{ includeOutOfStock: "yes" }]])(
    "rejects invalid input %j",
    (input) => {
      expect(listLowStockInput.safeParse(input).success).toBe(false);
    },
  );

  it("turns an API failure into a tool error", async () => {
    const { client } = failingClient();

    const result = await listLowStock(client, listLowStockInput.parse({}));

    expect(result.isError).toBe(true);
  });
});
