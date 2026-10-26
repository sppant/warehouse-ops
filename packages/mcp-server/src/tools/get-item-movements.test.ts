import { describe, expect, it } from "vitest";
import {
  getItemMovements,
  getItemMovementsInput,
  getItemMovementsOutput,
} from "./get-item-movements.js";
import { failingClient, fakeClient } from "./test-helpers.js";

const movement = (n: number) => ({
  id: `m-${n}`,
  type: "PICK",
  quantity: n,
  locationCode: "A-01",
  reason: null,
  referenceType: "SALES_ORDER",
  referenceId: "r",
  createdAt: `2026-01-0${n}T00:00:00.000Z`,
});

const api = (path: string) =>
  path === "/api/products"
    ? { data: [{ id: "p-1", sku: "AB10", name: "Other" }, { id: "p-2", sku: "AB1", name: "Widget" }] }
    : { data: [movement(3), movement(2), movement(1)] };

describe("get_item_movements", () => {
  it("resolves the SKU, then returns only the newest `limit` movements", async () => {
    const { client, get } = fakeClient(api);

    const result = await getItemMovements(
      client,
      getItemMovementsInput.parse({ sku: "ab1", limit: 2 }),
    );

    const output = getItemMovementsOutput.parse(result.structuredContent);
    expect(output).toMatchObject({ sku: "AB1", name: "Widget", total: 3 });
    expect(output.movements.map((m) => m.quantity)).toEqual([3, 2]);
    expect(get).toHaveBeenLastCalledWith("/api/inventory/movements", {
      productId: "p-2",
      locationId: undefined,
    });
  });

  it("reports an unknown SKU as a tool error", async () => {
    const { client } = fakeClient(() => ({ data: [] }));

    const result = await getItemMovements(client, getItemMovementsInput.parse({ sku: "NOPE" }));

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("search_items");
  });

  it.each([[{}], [{ sku: "A", limit: 0 }], [{ sku: "A", limit: 101 }], [{ sku: "A", locationId: "x" }]])(
    "rejects invalid input %j",
    (input) => {
      expect(getItemMovementsInput.safeParse(input).success).toBe(false);
    },
  );

  it("turns an API failure into a tool error", async () => {
    const { client } = failingClient();

    const result = await getItemMovements(client, getItemMovementsInput.parse({ sku: "A" }));

    expect(result.isError).toBe(true);
  });
});
