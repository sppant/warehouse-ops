import type {
  CreateLocationInput,
  CreateWarehouseInput,
} from "./warehouse.schema.js";
import { warehouseRepository } from "./warehouse.repository.js";

export class WarehouseNotFoundError extends Error {
  constructor() {
    super("Warehouse not found");
    this.name = "WarehouseNotFoundError";
  }
}

export class WarehouseCodeAlreadyExistsError extends Error {
  constructor() {
    super("A warehouse with this code already exists");
    this.name = "WarehouseCodeAlreadyExistsError";
  }
}

export class LocationCodeAlreadyExistsError extends Error {
  constructor() {
    super("A location with this code already exists in this warehouse");
    this.name = "LocationCodeAlreadyExistsError";
  }
}

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("cause" in error) {
    return getErrorCode(error.cause);
  }

  return undefined;
};

const isUniqueViolation = (error: unknown) => {
  return getErrorCode(error) === "23505";
};

export const warehouseService = {
  async list() {
    return warehouseRepository.findAll();
  },

  async getById(id: string) {
    const warehouse = await warehouseRepository.findById(id);

    if (!warehouse) {
      throw new WarehouseNotFoundError();
    }

    return warehouse;
  },

  async create(input: CreateWarehouseInput) {
    try {
      return await warehouseRepository.create({
        code: input.code,
        name: input.name,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new WarehouseCodeAlreadyExistsError();
      }

      throw error;
    }
  },

  async listLocations(warehouseId: string) {
    await this.getById(warehouseId);

    return warehouseRepository.findLocations(warehouseId);
  },

  async createLocation(
    warehouseId: string,
    input: CreateLocationInput,
  ) {
    await this.getById(warehouseId);

    try {
      return await warehouseRepository.createLocation({
        warehouseId,
        code: input.code,
        name: input.name,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new LocationCodeAlreadyExistsError();
      }

      throw error;
    }
  },
};
