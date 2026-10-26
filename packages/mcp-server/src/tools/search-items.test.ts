import { describe, expect, it } from "vitest";
import { searchItems, searchItemsInput, searchItemsOutput } from "./search-items.js";
import { apiRow, failingClient, fakeClient, overviewPage } from "./test-helpers.js";

describe("search_items", () => {
  it("returns compact rows and passes the filters to the API", async () => {
    const { client, get } = fakeClient(() => overviewPage([apiRow()], { total: 1 }));
    const input = searchItemsInput.parse({
      query: "widget",
      locationId: "11111111-1111-4111-8111-111111111111",
    });

    const result = await searchItems(client, input);

    expect(result.isError).toBeUndefined();
    expect(searchItemsOutput.parse(result.structuredContent)).toMatchObject({
      total: 1,
      truncated: false,
      items: [{ sku: "WIDGET-1", name: "Widget", available: 15 }],
    });
    expect(result.structuredContent!.items).not.toContainEqual(
      expect.objectContaining({ cycleCountFlaggedAt: expect.anything() }),
    );
    expect(get).toHaveBeenCalledWith("/api/inventory/overview", {
      search: "widget",
      locationId: "11111111-1111-4111-8111-111111111111",
      sortBy: "product",
      pageSize: 20,
    });
  });

  it("flags truncation when more rows match than were returned", async () => {
    const { client } = fakeClient(() => overviewPage([apiRow()], { total: 42 }));

    const result = await searchItems(client, searchItemsInput.parse({ query: "w" }));

    expect(result.structuredContent).toMatchObject({ total: 42, truncated: true });
  });

  it.each([
    [{}],
    [{ query: "" }],
    [{ query: "x".repeat(201) }],
    [{ query: "x", limit: 0 }],
    [{ query: "x", limit: 51 }],
    [{ query: "x", locationId: "not-a-uuid" }],
  ])("rejects invalid input %j", (input) => {
    expect(searchItemsInput.safeParse(input).success).toBe(false);
  });

  it("turns an API failure into a tool error", async () => {
    const { client } = failingClient();

    const result = await searchItems(client, searchItemsInput.parse({ query: "w" }));

    expect(result).toMatchObject({ isError: true });
    expect(result.content[0]!.text).toContain("(500)");
  });
});
