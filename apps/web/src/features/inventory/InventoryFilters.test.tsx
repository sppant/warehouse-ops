import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InventoryFilters } from "./InventoryFilters";

const locations = [
  { id: "l1", label: "A-01" },
  { id: "l2", label: "B-02" },
];

const setup = (overrides: Partial<Parameters<typeof InventoryFilters>[0]> = {}) => {
  const handlers = {
    onLocationChange: vi.fn(),
    onStatusChange: vi.fn(),
    onSearchChange: vi.fn(),
    onClear: vi.fn(),
  };
  render(
    <InventoryFilters
      locations={locations}
      locationId=""
      status=""
      search=""
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
};

describe("InventoryFilters", () => {
  it("exposes every control by its label", () => {
    setup();

    expect(screen.getByRole("search", { name: /filter inventory/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("reports location and status changes", async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await user.selectOptions(screen.getByLabelText("Location"), "B-02");
    await user.selectOptions(screen.getByLabelText("Status"), "Low stock");

    expect(handlers.onLocationChange).toHaveBeenCalledWith("l2");
    expect(handlers.onStatusChange).toHaveBeenCalledWith("LOW_STOCK");
  });

  it("reports each keystroke in the search box (debouncing happens in the page)", async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await user.type(screen.getByLabelText("Search"), "bo");

    expect(handlers.onSearchChange).toHaveBeenNthCalledWith(1, "b");
    expect(handlers.onSearchChange).toHaveBeenNthCalledWith(2, "o");
  });

  it("disables Clear filters when no filter is active", () => {
    setup();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });

  it("calls onClear when a filter is active", async () => {
    const user = userEvent.setup();
    const handlers = setup({ status: "LOW_STOCK" });

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(handlers.onClear).toHaveBeenCalledTimes(1);
  });
});
