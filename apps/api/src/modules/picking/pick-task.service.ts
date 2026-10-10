import type { PickItemInput } from "./pick-task.schema.js";
import { pickTaskRepository } from "./pick-task.repository.js";

export class PickTaskNotFoundError extends Error {
  constructor() {
    super("Pick task not found");
    this.name = "PickTaskNotFoundError";
  }
}

export class SalesOrderNotFoundError extends Error {
  constructor() {
    super("Sales order not found");
    this.name = "SalesOrderNotFoundError";
  }
}

export class InvalidSalesOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSalesOrderStateError";
  }
}

export class InsufficientInventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientInventoryError";
  }
}

export class PickTaskItemNotFoundError extends Error {
  constructor() {
    super("Pick task item not found");
    this.name = "PickTaskItemNotFoundError";
  }
}

export class InvalidPickError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPickError";
  }
}

export const pickTaskService = {
  async list() {
    return pickTaskRepository.findAll();
  },

  async get(id: string) {
    const task = await pickTaskRepository.findById(id);

    if (!task) {
      throw new PickTaskNotFoundError();
    }

    return task;
  },

  async generate(salesOrderId: string) {
    try {
      return await pickTaskRepository.generateForSalesOrder(salesOrderId);
    } catch (error) {
      if (error instanceof Error && error.message === "Sales order not found") {
        throw new SalesOrderNotFoundError();
      }

      if (
        error instanceof Error &&
        (error.message ===
          "Only allocated sales orders can generate a pick task" ||
          error.message === "Sales order has nothing left to pick")
      ) {
        throw new InvalidSalesOrderStateError(error.message);
      }

      if (
        error instanceof Error &&
        error.message === "Insufficient inventory to generate pick task"
      ) {
        throw new InsufficientInventoryError(error.message);
      }

      throw error;
    }
  },

  async pick(input: PickItemInput) {
    try {
      return await pickTaskRepository.pick(
        input.pickTaskItemId,
        input.quantity,
        input.reason,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Pick task item not found"
      ) {
        throw new PickTaskItemNotFoundError();
      }

      if (
        error instanceof Error &&
        (error.message ===
          "Cannot pick for a cancelled or completed pick task" ||
          error.message ===
            "Picked quantity cannot exceed the pick task item quantity" ||
          error.message ===
            "Picked quantity cannot exceed the allocated quantity" ||
          error.message === "Insufficient reserved inventory at location" ||
          error.message === "Sales order item not found")
      ) {
        throw new InvalidPickError(error.message);
      }

      throw error;
    }
  },
};
