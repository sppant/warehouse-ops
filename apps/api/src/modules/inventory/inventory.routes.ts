import type { FastifyInstance } from "fastify";
import {
  cycleCountFlagSchema,
  inventoryIdParamSchema,
  inventoryMovementsQuerySchema,
  inventoryOverviewQuerySchema,
  inventoryQuerySchema,
  receiveStockSchema,
} from "./inventory.schema.js";
import {
  InventoryNotFoundError,
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

  app.get("/api/inventory/overview", async (request, reply) => {
    const query = inventoryOverviewQuerySchema.safeParse(request.query);

    if (!query.success) {
      return reply.status(400).send({
        error: "Invalid inventory overview query",
        details: query.error.flatten(),
      });
    }

    return inventoryService.overview(query.data);
  });

  app.get("/api/inventory/summary", async () => {
    const data = await inventoryService.summary();

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

  app.put("/api/inventory/:id/cycle-count-flag", async (request, reply) => {
    const params = inventoryIdParamSchema.safeParse(request.params);
    const body = cycleCountFlagSchema.safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "Invalid cycle count flag request",
        details: {
          params: params.success ? undefined : params.error.flatten(),
          body: body.success ? undefined : body.error.flatten(),
        },
      });
    }

    try {
      const data = await inventoryService.setCycleCountFlag(
        params.data.id,
        body.data.flagged,
      );

      return { data };
    } catch (error) {
      if (error instanceof InventoryNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }

      throw error;
    }
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
