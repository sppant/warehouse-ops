import { describe, expect, it, vi, beforeEach } from "vitest";

import { db } from "../../db/index.js";
import { purchaseOrderRepository } from "./purchase-order.repository.js";
import {
  ProductNotFoundError,
  PurchaseOrderAlreadyExistsError,
  PurchaseOrderNotFoundError,
  purchaseOrderService,
} from "./purchase-order.service.js";

vi.mock("./purchase-order.repository.js", () => ({
  purchaseOrderRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

const mockedRepository = vi.mocked(purchaseOrderRepository);
const mockedDb = vi.mocked(db);

describe("purchaseOrderService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists purchase orders", async () => {
    const orders = [
      {
        id: "po-1",
        orderNumber: "PO-1001",
        supplier: "Acme Supplies",
      },
    ];

    mockedRepository.findAll.mockResolvedValue(orders as never);

    await expect(purchaseOrderService.list()).resolves.toEqual(orders);
  });

  it("returns a purchase order with items", async () => {
    const order = {
      id: "po-1",
      orderNumber: "PO-1001",
      items: [],
    };

    mockedRepository.findById.mockResolvedValue(order as never);

    await expect(
      purchaseOrderService.get("po-1"),
    ).resolves.toEqual(order);
  });

  it("throws when the purchase order does not exist", async () => {
    mockedRepository.findById.mockResolvedValue(null);

    await expect(
      purchaseOrderService.get("missing"),
    ).rejects.toBeInstanceOf(PurchaseOrderNotFoundError);
  });

  it("creates a purchase order with validated products", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ id: "product-1" }]);

    mockedDb.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: selectLimit,
        }),
      }),
    } as never);

    const createdOrder = {
      id: "po-1",
      orderNumber: "PO-1001",
      supplier: "Acme Supplies",
      items: [],
    };

    mockedRepository.create.mockResolvedValue(createdOrder as never);

    await expect(
      purchaseOrderService.create({
        orderNumber: "PO-1001",
        supplier: "Acme Supplies",
        items: [
          {
            productId: "product-1",
            orderedQuantity: 10,
            unitCost: 12.5,
          },
        ],
      }),
    ).resolves.toEqual(createdOrder);

    expect(mockedRepository.create).toHaveBeenCalledWith(
      {
        orderNumber: "PO-1001",
        supplier: "Acme Supplies",
        expectedAt: null,
      },
      [
        {
          productId: "product-1",
          orderedQuantity: 10,
          receivedQuantity: 0,
          unitCost: "12.50",
        },
      ],
    );
  });

  it("throws when a product does not exist", async () => {
    const selectLimit = vi.fn().mockResolvedValue([]);

    mockedDb.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: selectLimit,
        }),
      }),
    } as never);

    await expect(
      purchaseOrderService.create({
        orderNumber: "PO-1001",
        supplier: "Acme Supplies",
        items: [
          {
            productId: "missing",
            orderedQuantity: 10,
            unitCost: 12.5,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);

    expect(mockedRepository.create).not.toHaveBeenCalled();
  });

  it("maps duplicate PO numbers to a domain error", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ id: "product-1" }]);

    mockedDb.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: selectLimit,
        }),
      }),
    } as never);

    mockedRepository.create.mockRejectedValue({
      cause: {
        code: "23505",
      },
    });

    await expect(
      purchaseOrderService.create({
        orderNumber: "PO-1001",
        supplier: "Acme Supplies",
        items: [
          {
            productId: "product-1",
            orderedQuantity: 10,
            unitCost: 12.5,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PurchaseOrderAlreadyExistsError);
  });

  it("updates purchase order status", async () => {
    const updatedOrder = {
      id: "po-1",
      status: "ORDERED",
    };

    mockedRepository.updateStatus.mockResolvedValue(updatedOrder as never);

    await expect(
      purchaseOrderService.updateStatus("po-1", {
        status: "ORDERED",
      }),
    ).resolves.toEqual(updatedOrder);
  });

  it("throws when updating a missing purchase order", async () => {
    mockedRepository.updateStatus.mockResolvedValue(null);

    await expect(
      purchaseOrderService.updateStatus("missing", {
        status: "ORDERED",
      }),
    ).rejects.toBeInstanceOf(PurchaseOrderNotFoundError);
  });
});
