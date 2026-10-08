import type { FastifyInstance } from "fastify";
import {
  inventoryMovementsQuerySchema,
  inventoryQuerySchema,
  receiveStockSchema,
} from "./inventory.schema.js";
import {
  LocationNotFoundError,
  ProductNotFoundError,
  inventoryService,
} from "./inventory.service.js";

export async function inventoryRoutes(app: FastifyInstance) {
  app.get("/api/inventory", async (request, reply) => {
    const query = inventoryQuerySchema.safeParse(request.query);

    if (!query.success) {
      return reply.status(400).send({
        error: "Invalid inventory query",
        details: query.error.flatten(),
      });
    }

    const data = await inventoryService.list(query.data);

    return { data };
  });

  app.get("/api/inventory/movements", async (request, reply) => {
    const query = inventoryMovementsQuerySchema.safeParse(request.query);

    if (!query.success) {
      return reply.status(400).send({
        error: "Invalid inventory movement query",
        details: query.error.flatten(),
      });
    }

    const data = await inventoryService.listMovements(query.data);

    return { data };
  });

  app.post("/api/inventory/receive", async (request, reply) => {
    const body = receiveStockSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid receiving data",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await inventoryService.receiveStock(body.data);

      return reply.status(201).send({ data });
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      if (error instanceof LocationNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });
}
