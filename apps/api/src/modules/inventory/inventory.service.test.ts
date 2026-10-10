import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/index.js";
import { inventoryRepository } from "./inventory.repository.js";
import {
  InsufficientAvailableInventoryError,
  InvalidReleaseError,
  LocationNotFoundError,
  ProductNotFoundError,
  inventoryService,
} from "./inventory.service.js";

vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("./inventory.repository.js", () => ({
  inventoryRepository: {
    findAll: vi.fn(),
    receiveStock: vi.fn(),
    reserveStock: vi.fn(),
    releaseStock: vi.fn(),
  },
}));

const mockedDb = vi.mocked(db);
const mockedRepository = vi.mocked(inventoryRepository);

describe("inventoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("receives stock for an existing product and location", async () => {
    const productLimit = vi.fn().mockResolvedValue([{ id: "product-1" }]);
    const locationLimit = vi.fn().mockResolvedValue([{ id: "location-1" }]);

    mockedDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: productLimit,
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: locationLimit,
          }),
        }),
      } as never);

    mockedRepository.receiveStock.mockResolvedValue({
      id: "inventory-1",
      productId: "product-1",
      locationId: "location-1",
      onHand: 10,
      reserved: 0,
      damaged: 0,
      updatedAt: new Date(),
    });

    const result = await inventoryService.receiveStock({
      productId: "product-1",
      locationId: "location-1",
      quantity: 10,
      reason: "Initial receipt",
    });

    expect(result.onHand).toBe(10);
    expect(mockedRepository.receiveStock).toHaveBeenCalledWith(
      "product-1",
      "location-1",
      10,
      "Initial receipt",
    );
  });

  it("throws when the product does not exist", async () => {
    const productLimit = vi.fn().mockResolvedValue([]);

    mockedDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: productLimit,
        }),
      }),
    } as never);

    await expect(
      inventoryService.receiveStock({
        productId: "missing",
        locationId: "location-1",
        quantity: 10,
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);

    expect(mockedRepository.receiveStock).not.toHaveBeenCalled();
  });

  it("throws when the location does not exist", async () => {
    const productLimit = vi.fn().mockResolvedValue([{ id: "product-1" }]);
    const locationLimit = vi.fn().mockResolvedValue([]);

    mockedDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: productLimit,
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: locationLimit,
          }),
        }),
      } as never);

    await expect(
      inventoryService.receiveStock({
        productId: "product-1",
        locationId: "missing",
        quantity: 10,
      }),
    ).rejects.toBeInstanceOf(LocationNotFoundError);

    expect(mockedRepository.receiveStock).not.toHaveBeenCalled();
  });

  const mockProductAndLocationExist = () => {
    const productLimit = vi.fn().mockResolvedValue([{ id: "product-1" }]);
    const locationLimit = vi.fn().mockResolvedValue([{ id: "location-1" }]);

    mockedDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: productLimit,
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: locationLimit,
          }),
        }),
      } as never);
  };

  it("reserves stock when enough is available", async () => {
    mockProductAndLocationExist();

    mockedRepository.reserveStock.mockResolvedValue({
      id: "inventory-1",
      productId: "product-1",
      locationId: "location-1",
      onHand: 10,
      reserved: 5,
      damaged: 0,
      updatedAt: new Date(),
    });

    const result = await inventoryService.reserveStock({
      productId: "product-1",
      locationId: "location-1",
      quantity: 5,
    });

    expect(result.reserved).toBe(5);
    expect(mockedRepository.reserveStock).toHaveBeenCalledWith(
      "product-1",
      "location-1",
      5,
    );
  });

  it("throws when reserving more than is available", async () => {
    mockProductAndLocationExist();

    mockedRepository.reserveStock.mockRejectedValue(
      new Error("Insufficient available inventory"),
    );

    await expect(
      inventoryService.reserveStock({
        productId: "product-1",
        locationId: "location-1",
        quantity: 999,
      }),
    ).rejects.toBeInstanceOf(InsufficientAvailableInventoryError);
  });

  it("releases previously reserved stock", async () => {
    mockProductAndLocationExist();

    mockedRepository.releaseStock.mockResolvedValue({
      id: "inventory-1",
      productId: "product-1",
      locationId: "location-1",
      onHand: 10,
      reserved: 0,
      damaged: 0,
      updatedAt: new Date(),
    });

    const result = await inventoryService.releaseStock({
      productId: "product-1",
      locationId: "location-1",
      quantity: 5,
    });

    expect(result.reserved).toBe(0);
    expect(mockedRepository.releaseStock).toHaveBeenCalledWith(
      "product-1",
      "location-1",
      5,
    );
  });

  it("throws when releasing more than is reserved", async () => {
    mockProductAndLocationExist();

    mockedRepository.releaseStock.mockRejectedValue(
      new Error("Cannot release more than reserved quantity"),
    );

    await expect(
      inventoryService.releaseStock({
        productId: "product-1",
        locationId: "location-1",
        quantity: 999,
      }),
    ).rejects.toBeInstanceOf(InvalidReleaseError);
  });
});
