import { describe, expect, it } from "vitest";
import { getStockLevel, getStockLevelInput, getStockLevelOutput } from "./get-stock-level.js";
import { apiRow, failingClient, fakeClient, overviewPage } from "./test-helpers.js";

describe("get_stock_level", () => {
  it("sums the exact-SKU rows and ignores other substring matches", async () => {
    const { client } = fakeClient(() =>
      overviewPage([
        apiRow({ sku: "AB1", locationCode: "A-01", onHand: 10, reserved: 2, available: 8 }),
        apiRow({ sku: "AB1", locationCode: "B-01", onHand: 5, reserved: 0, available: 5 }),
        apiRow({ sku: "AB10", locationCode: "A-02", onHand: 99, available: 99 }),
      ]),
    );

    const result = await getStockLevel(client, getStockLevelInput.parse({ sku: "ab1" }));

    const output = getStockLevelOutput.parse(result.structuredContent);
    expect(output.totals).toEqual({ onHand: 15, reserved: 2, damaged: 0, available: 13 });
    expect(output.locations.map((row) => row.locationCode)).toEqual(["A-01", "B-01"]);
  });

  it("keeps paging until the exact SKU turns up", async () => {
    const { client, get } = fakeClient((_path, query) =>
      query.page === 1
        ? overviewPage([apiRow({ sku: "AB10" })], { total: 2, totalPages: 2 })
        : overviewPage([apiRow({ sku: "AB1" })], { total: 2, totalPages: 2 }),
    );

    const result = await getStockLevel(client, getStockLevelInput.parse({ sku: "AB1" }));

    expect(result.isError).toBeUndefined();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("reports an unknown SKU as a tool error that points to search_items", async () => {
    const { client } = fakeClient(() => overviewPage([apiRow({ sku: "OTHER" })]));

    const result = await getStockLevel(client, getStockLevelInput.parse({ sku: "NOPE" }));

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("search_items");
  });

  it.each([[{}], [{ sku: "" }], [{ sku: "x".repeat(101) }], [{ sku: "A", locationId: "x" }]])(
    "rejects invalid input %j",
    (input) => {
      expect(getStockLevelInput.safeParse(input).success).toBe(false);
    },
  );

  it("turns an API failure into a tool error", async () => {
    const { client } = failingClient("Could not reach the Warehouse Ops API at http://x.");

    const result = await getStockLevel(client, getStockLevelInput.parse({ sku: "A" }));

    expect(result).toMatchObject({ isError: true });
    expect(result.content[0]!.text).toContain("Could not reach");
  });
});
