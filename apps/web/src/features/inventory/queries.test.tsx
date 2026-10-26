import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inventoryKeys,
  type OverviewItem,
  type OverviewParams,
  type OverviewResponse,
} from "./overview";
import { useCycleCountFlag, useInventoryOverview } from "./queries";

const baseParams: OverviewParams = {
  sortBy: "product",
  sortDir: "asc",
  page: 1,
  pageSize: 10,
};

const item = (id: string, flagged: string | null = null): OverviewItem => ({
  id,
  productId: `p-${id}`,
  sku: `SKU-${id}`,
  productName: `Product ${id}`,
  locationId: "l1",
  locationCode: "A-01",
  warehouseCode: "W1",
  onHand: 10,
  reserved: 0,
  damaged: 0,
  available: 10,
  status: "IN_STOCK",
  lastMovementAt: null,
  cycleCountFlaggedAt: flagged,
});

const response = (items: OverviewItem[]): OverviewResponse => ({
  data: items,
  meta: { page: 1, pageSize: 10, total: items.length, totalPages: 1 },
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useInventoryOverview", () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("caches each filter combination under its own key and sends it to the API", async () => {
    fetchMock.mockImplementation(() => json(response([item("1")])));
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(
      () => useInventoryOverview({ ...baseParams, status: "LOW_STOCK", search: "bolt" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("status=LOW_STOCK");
    expect(url).toContain("search=bolt");
    expect(
      queryClient.getQueryData(
        inventoryKeys.overview({ ...baseParams, status: "LOW_STOCK", search: "bolt" }),
      ),
    ).toBeDefined();
    expect(queryClient.getQueryData(inventoryKeys.overview(baseParams))).toBeUndefined();
  });

  it("keeps showing the previous result while the next page loads", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(() => json(response([item("1")])));
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(new Response(JSON.stringify(response([item("2")]))));
        }),
    );
    const { wrapper } = setup();

    const { result, rerender } = renderHook(
      ({ page }) => useInventoryOverview({ ...baseParams, page }),
      { wrapper, initialProps: { page: 1 } },
    );
    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe("1"));

    rerender({ page: 2 });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.data?.data[0]?.id).toBe("1");

    act(() => release());
    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe("2"));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("serves a fresh cached result without another request", async () => {
    fetchMock.mockImplementation(() => json(response([item("1")])));
    const { wrapper } = setup();

    const first = renderHook(() => useInventoryOverview(baseParams), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useInventoryOverview(baseParams), { wrapper });
    expect(second.result.current.data).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useCycleCountFlag", () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  const flagOf = (queryClient: QueryClient, id: string) =>
    queryClient
      .getQueryData<OverviewResponse>(inventoryKeys.overview(baseParams))!
      .data.find((row) => row.id === id)!.cycleCountFlaggedAt;

  it("flags the row immediately, before the server answers, then refetches", async () => {
    let serverFlagged: string | null = null;
    let release!: () => void;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Promise((resolve) => {
          release = () => {
            serverFlagged = "2026-01-01T00:00:00.000Z";
            resolve(new Response(JSON.stringify({ data: { id: "1", cycleCountFlaggedAt: serverFlagged } })));
          };
        });
      }
      return json(response([item("1", serverFlagged)]));
    });
    const { queryClient, wrapper } = setup();

    const overview = renderHook(() => useInventoryOverview(baseParams), { wrapper });
    await waitFor(() => expect(overview.result.current.isSuccess).toBe(true));
    const flag = renderHook(() => useCycleCountFlag(), { wrapper });

    act(() => flag.result.current.mutate({ id: "1", flagged: true }));

    await waitFor(() => expect(flagOf(queryClient, "1")).not.toBeNull());
    expect(flag.result.current.isPending).toBe(true);
    const guess = flagOf(queryClient, "1");

    act(() => release());
    await waitFor(() => expect(flagOf(queryClient, "1")).toBe("2026-01-01T00:00:00.000Z"));
    expect(flagOf(queryClient, "1")).not.toBe(guess);
  });

  it("rolls the row back when the server rejects the change, before any refetch", async () => {
    let overviewCalls = 0;
    let failPut!: () => void;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Promise<Response>((resolve) => {
          failPut = () => resolve(new Response(JSON.stringify({ error: "boom" }), { status: 500 }));
        });
      }
      overviewCalls += 1;
      // The refetch after the failure never answers, so the only thing that
      // can undo the optimistic flag is the rollback itself.
      return overviewCalls === 1
        ? json(response([item("1"), item("2", "2025-12-31T00:00:00.000Z")]))
        : new Promise<Response>(() => undefined);
    });
    const { queryClient, wrapper } = setup();

    const overview = renderHook(() => useInventoryOverview(baseParams), { wrapper });
    await waitFor(() => expect(overview.result.current.isSuccess).toBe(true));
    const flag = renderHook(() => useCycleCountFlag(), { wrapper });

    act(() => flag.result.current.mutate({ id: "1", flagged: true }));
    // First the optimistic flag appears, then the failed PUT takes it away.
    await waitFor(() => expect(flagOf(queryClient, "1")).not.toBeNull());
    act(() => failPut());
    await waitFor(() => expect(flagOf(queryClient, "1")).toBeNull());

    // The refetch was requested but is still pending: the revert is the rollback.
    expect(overviewCalls).toBe(2);
    // Other rows are untouched by the rollback.
    expect(flagOf(queryClient, "2")).toBe("2025-12-31T00:00:00.000Z");
  });
});
