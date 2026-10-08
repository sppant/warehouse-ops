import { beforeEach, describe, expect, it, vi } from "vitest";
import { warehouseRepository } from "./warehouse.repository.js";
import {
  LocationCodeAlreadyExistsError,
  WarehouseCodeAlreadyExistsError,
  WarehouseNotFoundError,
  warehouseService,
} from "./warehouse.service.js";

vi.mock("./warehouse.repository.js", () => ({
  warehouseRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findLocations: vi.fn(),
    createLocation: vi.fn(),
  },
}));

const mockedRepository = vi.mocked(warehouseRepository);

describe("warehouseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a warehouse", async () => {
    mockedRepository.create.mockResolvedValue({
      id: "warehouse-1",
      code: "MAIN",
      name: "Central Warehouse",
      createdAt: new Date(),
    });

    const result = await warehouseService.create({
      code: "MAIN",
      name: "Central Warehouse",
    });

    expect(result.code).toBe("MAIN");
    expect(mockedRepository.create).toHaveBeenCalledWith({
      code: "MAIN",
      name: "Central Warehouse",
    });
  });

  it("maps duplicate warehouse code to a domain error", async () => {
    mockedRepository.create.mockRejectedValue({
      cause: {
        code: "23505",
      },
    });

    await expect(
      warehouseService.create({
        code: "MAIN",
        name: "Another Warehouse",
      }),
    ).rejects.toBeInstanceOf(WarehouseCodeAlreadyExistsError);
  });

  it("throws when the warehouse does not exist", async () => {
    mockedRepository.findById.mockResolvedValue(undefined);

    await expect(
      warehouseService.getById("missing"),
    ).rejects.toBeInstanceOf(WarehouseNotFoundError);
  });

  it("creates a location after verifying the warehouse exists", async () => {
    mockedRepository.findById.mockResolvedValue({
      id: "warehouse-1",
      code: "MAIN",
      name: "Central Warehouse",
      createdAt: new Date(),
    });

    mockedRepository.createLocation.mockResolvedValue({
      id: "location-1",
      warehouseId: "warehouse-1",
      code: "A-01-01",
      name: "Shelf 01",
      createdAt: new Date(),
    });

    const result = await warehouseService.createLocation("warehouse-1", {
      code: "A-01-01",
      name: "Shelf 01",
    });

    expect(result.code).toBe("A-01-01");
    expect(mockedRepository.createLocation).toHaveBeenCalledWith({
      warehouseId: "warehouse-1",
      code: "A-01-01",
      name: "Shelf 01",
    });
  });

  it("maps duplicate location code to a domain error", async () => {
    mockedRepository.findById.mockResolvedValue({
      id: "warehouse-1",
      code: "MAIN",
      name: "Central Warehouse",
      createdAt: new Date(),
    });

    mockedRepository.createLocation.mockRejectedValue({
      cause: {
        code: "23505",
      },
    });

    await expect(
      warehouseService.createLocation("warehouse-1", {
        code: "A-01-01",
        name: "Duplicate",
      }),
    ).rejects.toBeInstanceOf(LocationCodeAlreadyExistsError);
  });

  it("does not create a location for a missing warehouse", async () => {
    mockedRepository.findById.mockResolvedValue(undefined);

    await expect(
      warehouseService.createLocation("missing", {
        code: "A-01-01",
        name: "Shelf 01",
      }),
    ).rejects.toBeInstanceOf(WarehouseNotFoundError);

    expect(mockedRepository.createLocation).not.toHaveBeenCalled();
  });
});
