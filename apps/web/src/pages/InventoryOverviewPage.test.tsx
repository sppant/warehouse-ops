import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OverviewItem } from "../features/inventory/overview";
import { InventoryOverviewPage } from "./InventoryOverviewPage";

// The page is covered by its parts' own tests; here only the chart wiring is
// stubbed, because recharts needs real layout that jsdom does not provide.
vi.mock("../features/inventory/InventoryCharts", () => ({
  InventoryCharts: () => <div data-testid="charts" />,
}));

const row = (n: number, overrides: Partial<OverviewItem> = {}): OverviewItem => ({
  id: `id-${n}`,
  productId: `p-${n}`,
  sku: `SKU-${n}`,
  productName: `Product ${n}`,
  locationId: "l1",
  locationCode: "A-01",
  warehouseCode: "W1",
  onHand: 10,
  reserved: 0,
  damaged: 0,
  available: 10,
  status: "IN_STOCK",
  lastMovementAt: null,
  cycleCountFlaggedAt: null,
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const overviewCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/inventory/overview"))
    .map((url) => new URL(url, "http://x").searchParams);

describe("InventoryOverviewPage", () => {
  const fetchMock = vi.fn();
  let overviewHandler: (params: URLSearchParams) => Response | Promise<Response>;
  let flagHandler: () => Response | Promise<Response>;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    overviewHandler = (params) => {
      const page = Number(params.get("page"));
      return json({
        data: [row(page)],
        meta: { page, pageSize: 10, total: 30, totalPages: 3 },
      });
    };
    flagHandler = () => json({ data: { id: "id-1", cycleCountFlaggedAt: "2026-10-10T00:00:00.000Z" } });

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/warehouses") return json({ data: [{ id: "w1", code: "W1", name: "Main", createdAt: "" }] });
      if (url === "/api/warehouses/w1/locations") return json({ data: [{ id: "l1", warehouseId: "w1", code: "A-01", name: "A", createdAt: "" }] });
      if (url === "/api/inventory/summary") return json({ data: { stockByLocation: [], movementsPerDay: [], topItems: [] } });
      if (init?.method === "PUT") return flagHandler();
      if (url.startsWith("/api/inventory/overview")) return overviewHandler(new URL(url, "http://x").searchParams);
      return json({ error: `unexpected ${url}` }, 404);
    });
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  const renderPage = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <InventoryOverviewPage />
      </QueryClientProvider>,
    );
  };

  it("loads the first page with default sorting", async () => {
    renderPage();

    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–10 of 30")).toBeInTheDocument();
    expect(overviewCalls(fetchMock)[0]!.get("sortBy")).toBe("product");
    expect(overviewCalls(fetchMock)[0]!.get("pageSize")).toBe("10");
  });

  it("sends one request per pause in typing, not one per keystroke", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Product 1");

    await user.type(screen.getByLabelText("Search"), "bolt");

    await waitFor(() =>
      expect(overviewCalls(fetchMock).some((p) => p.get("search") === "bolt")).toBe(true),
    );
    const searches = overviewCalls(fetchMock).map((p) => p.get("search")).filter(Boolean);
    expect(searches).toEqual(["bolt"]);
  });

  it("returns to page 1 when a filter changes, and sends the filter", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Product 1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Product 2");
    await user.selectOptions(screen.getByLabelText("Status"), "Low stock");

    await waitFor(() => {
      const last = overviewCalls(fetchMock).at(-1)!;
      expect(last.get("status")).toBe("LOW_STOCK");
      expect(last.get("page")).toBe("1");
    });
  });

  it("toggles sort direction and starts numeric columns descending", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Product 1");

    await user.click(screen.getByRole("button", { name: /available/i }));
    await waitFor(() => {
      const last = overviewCalls(fetchMock).at(-1)!;
      expect(last.get("sortBy")).toBe("available");
      expect(last.get("sortDir")).toBe("desc");
    });

    await user.click(screen.getByRole("button", { name: /available/i }));
    await waitFor(() => expect(overviewCalls(fetchMock).at(-1)!.get("sortDir")).toBe("asc"));
  });

  it("keeps the current rows on screen while the next page loads", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Product 1");

    let release!: () => void;
    overviewHandler = (params) =>
      new Promise((resolve) => {
        release = () =>
          resolve(json({ data: [row(2)], meta: { page: Number(params.get("page")), pageSize: 10, total: 30, totalPages: 3 } }));
      });

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByRole("table").closest(".inv-table-wrap")).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByText("Product 1")).toBeInTheDocument();

    release();
    expect(await screen.findByText("Product 2")).toBeInTheDocument();
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
  });

  it("shows an error state and recovers on Retry", async () => {
    const user = userEvent.setup();
    overviewHandler = () => json({ error: "db down" }, 500);
    renderPage();

    const alert = await screen.findByText("Failed to load inventory.");
    expect(alert).toBeInTheDocument();

    overviewHandler = () => json({ data: [row(1)], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } });
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Product 1")).toBeInTheDocument();
  });

  it("flags a row immediately and keeps it flagged once the server confirms", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    flagHandler = () =>
      new Promise((resolve) => {
        release = () => resolve(json({ data: { id: "id-1", cycleCountFlaggedAt: "2026-10-10T00:00:00.000Z" } }));
      });
    renderPage();
    await screen.findByText("Product 1");

    await user.click(screen.getByRole("button", { name: "Flag SKU-1 at A-01 for cycle count" }));

    // Optimistic: flagged before the PUT has resolved.
    expect(await screen.findByRole("button", { name: /flagged: sku-1/i })).toBeInTheDocument();

    overviewHandler = (params) =>
      json({
        data: [row(1, { cycleCountFlaggedAt: "2026-10-10T00:00:00.000Z" })],
        meta: { page: Number(params.get("page")), pageSize: 10, total: 30, totalPages: 3 },
      });
    release();

    await waitFor(() => expect(overviewCalls(fetchMock).length).toBeGreaterThan(1));
    expect(await screen.findByRole("button", { name: /flagged: sku-1/i })).toBeInTheDocument();
  });

  it("reverts the flag and says so when the server rejects it", async () => {
    const user = userEvent.setup();
    flagHandler = () => json({ error: "nope" }, 500);
    renderPage();
    await screen.findByText("Product 1");

    await user.click(screen.getByRole("button", { name: "Flag SKU-1 at A-01 for cycle count" }));

    expect(await screen.findByText(/change was reverted/i)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(
      await within(table).findByRole("button", { name: "Flag SKU-1 at A-01 for cycle count" }),
    ).toBeInTheDocument();
  });
});
