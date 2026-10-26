import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InventoryTable } from "./InventoryTable";
import type { OverviewItem } from "./overview";

const item = (overrides: Partial<OverviewItem> = {}): OverviewItem => ({
  id: "1",
  productId: "p1",
  sku: "BLT-2001",
  productName: "Hex Bolt M8",
  locationId: "l1",
  locationCode: "A-01-01",
  warehouseCode: "DC-01",
  onHand: 120,
  reserved: 20,
  damaged: 0,
  available: 100,
  status: "IN_STOCK",
  lastMovementAt: "2026-10-09T15:18:39.808Z",
  cycleCountFlaggedAt: null,
  ...overrides,
});

type Props = Parameters<typeof InventoryTable>[0];

const setup = (overrides: Partial<Props> = {}) => {
  const handlers = {
    onRetry: vi.fn(),
    onSortChange: vi.fn(),
    onPageChange: vi.fn(),
    onToggleFlag: vi.fn(),
  };
  const props: Props = {
    items: [item()],
    pageSize: 10,
    page: 2,
    totalPages: 5,
    total: 47,
    sortBy: "product",
    sortDir: "asc",
    isLoading: false,
    isRefreshing: false,
    isError: false,
    hasActiveFilters: false,
    ...handlers,
    ...overrides,
  };
  const view = render(<InventoryTable {...props} />);
  return { ...handlers, ...view };
};

describe("InventoryTable states", () => {
  it("renders rows with a status badge and formatted values", () => {
    setup({
      items: [
        item(),
        item({ id: "2", sku: "NUT-1", status: "LOW_STOCK", lastMovementAt: null }),
      ],
    });

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("Hex Bolt M8")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("In stock")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Low stock")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("—")).toBeInTheDocument();
  });

  it("shows one placeholder row per page slot while loading, and no data rows", () => {
    const { container } = setup({ items: [], isLoading: true });

    expect(container.querySelectorAll(".inv-skeleton-row")).toHaveLength(10);
    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
    expect(container.querySelector(".inv-table-wrap")).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the old rows (dimmed and busy) while the next page loads", () => {
    const { container } = setup({ isRefreshing: true });

    expect(screen.getByText("Hex Bolt M8")).toBeInTheDocument();
    expect(container.querySelector("tbody")).toHaveClass("inv-stale");
    expect(container.querySelector(".inv-table-wrap")).toHaveAttribute("aria-busy", "true");
  });

  it("shows an error with a working Retry", async () => {
    const user = userEvent.setup();
    const { onRetry } = setup({ items: [], isError: true });

    expect(screen.getByRole("alert")).toHaveTextContent(/failed to load inventory/i);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps showing stale rows instead of an error if a refetch fails", () => {
    setup({ isError: true });

    expect(screen.getByText("Hex Bolt M8")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes 'nothing yet' from 'no match for these filters'", () => {
    const { rerender, container } = setup({ items: [], total: 0, page: 1, totalPages: 1 });
    expect(screen.getByText("No inventory found.")).toBeInTheDocument();
    expect(container.querySelector(".inv-table-wrap")).toBeInTheDocument();

    rerender(
      <InventoryTable
        {...({
          items: [], pageSize: 10, page: 1, totalPages: 1, total: 0,
          sortBy: "product", sortDir: "asc", isLoading: false, isRefreshing: false,
          isError: false, hasActiveFilters: true,
          onRetry: vi.fn(), onSortChange: vi.fn(), onPageChange: vi.fn(), onToggleFlag: vi.fn(),
        } satisfies Props)}
      />,
    );
    expect(screen.getByText("No inventory matches these filters.")).toBeInTheDocument();
  });

  it("reserves the same height for a page of rows in every state", () => {
    const { container } = setup({ pageSize: 25, items: [] , isLoading: true });

    const wrap = container.querySelector<HTMLElement>(".inv-table-wrap")!;
    expect(wrap.style.getPropertyValue("--inv-rows")).toBe("25");
  });
});

describe("InventoryTable sorting", () => {
  it("marks the sorted column with aria-sort and the rest as none", () => {
    setup({ sortBy: "available", sortDir: "desc" });

    expect(screen.getByRole("columnheader", { name: /available/i })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /^product/i })).toHaveAttribute("aria-sort", "none");
  });

  it("requests a sort when a header button is activated by mouse or keyboard", async () => {
    const user = userEvent.setup();
    const { onSortChange } = setup();

    await user.click(screen.getByRole("button", { name: /on hand/i }));
    await user.tab();
    await user.keyboard("{Enter}");

    expect(onSortChange).toHaveBeenCalledWith("onHand");
    expect(onSortChange).toHaveBeenCalledTimes(2);
  });
});

describe("InventoryTable pagination", () => {
  it("reports the visible range and moves between pages", async () => {
    const user = userEvent.setup();
    const { onPageChange } = setup();

    expect(screen.getByText("Showing 11–20 of 47")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables Previous on the first page and Next on the last", () => {
    const { unmount } = setup({ page: 1 });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    unmount();

    setup({ page: 5 });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("Showing 41–47 of 47")).toBeInTheDocument();
  });
});

describe("InventoryTable flag button", () => {
  it("has a descriptive name and toggles the flag", async () => {
    const user = userEvent.setup();
    const target = item();
    const { onToggleFlag } = setup({ items: [target] });

    await user.click(
      screen.getByRole("button", { name: "Flag BLT-2001 at A-01-01 for cycle count" }),
    );

    expect(onToggleFlag).toHaveBeenCalledWith(target);
  });

  it("shows the flagged state and disables the row's button while saving", () => {
    setup({
      items: [item({ cycleCountFlaggedAt: "2026-10-10T00:00:00.000Z" })],
      pendingFlagId: "1",
    });

    const button = screen.getByRole("button", { name: /flagged: blt-2001/i });
    expect(button).toHaveTextContent("Flagged");
    expect(button).toBeDisabled();
  });
});
