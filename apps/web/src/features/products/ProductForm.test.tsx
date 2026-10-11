import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductForm } from "./ProductForm";

describe("ProductForm", () => {
  it("rejects an empty SKU and name instead of submitting", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <ProductForm onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(await screen.findByText(/sku is required/i)).toBeInTheDocument();
    expect(screen.getByText(/product name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a negative unit cost", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <ProductForm onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/sku/i), "WH-1001");
    await user.type(screen.getByLabelText(/product name/i), "Wireless Scanner");
    fireEvent.change(screen.getByLabelText(/unit cost/i), {
      target: { value: "-5" },
    });
    // The input's native `min="0"` would otherwise block the browser's own
    // submit before React/Zod ever sees the value, so submit the form
    // directly to exercise the app's own validation.
    fireEvent.submit(container.querySelector("form")!);

    expect(
      await screen.findByText(/unit cost cannot be negative/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits parsed values once the form is valid", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <ProductForm onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/sku/i), "WH-1001");
    await user.type(screen.getByLabelText(/product name/i), "Wireless Scanner");
    fireEvent.change(screen.getByLabelText(/unit cost/i), {
      target: { value: "19.99" },
    });
    fireEvent.change(screen.getByLabelText(/weight/i), {
      target: { value: "500" },
    });
    await user.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "WH-1001",
        name: "Wireless Scanner",
        unitCost: 19.99,
        unitWeightGrams: 500,
      }),
      expect.anything(),
    );
  });
});
