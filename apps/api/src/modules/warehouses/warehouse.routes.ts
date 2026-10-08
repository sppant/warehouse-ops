import type { FastifyInstance } from "fastify";
import {
  createLocationSchema,
  createWarehouseSchema,
  warehouseIdSchema,
} from "./warehouse.schema.js";
import {
  LocationCodeAlreadyExistsError,
  WarehouseCodeAlreadyExistsError,
  WarehouseNotFoundError,
  warehouseService,
} from "./warehouse.service.js";

export async function warehouseRoutes(app: FastifyInstance) {
  app.get("/api/warehouses", async () => {
    const data = await warehouseService.list();

    return { data };
  });

  app.get("/api/warehouses/:id", async (request, reply) => {
    const params = warehouseIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid warehouse ID",
      });
    }

    try {
      const data = await warehouseService.getById(params.data.id);

      return { data };
    } catch (error) {
      if (error instanceof WarehouseNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post("/api/warehouses", async (request, reply) => {
    const body = createWarehouseSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid warehouse data",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await warehouseService.create(body.data);

      return reply.status(201).send({ data });
    } catch (error) {
      if (error instanceof WarehouseCodeAlreadyExistsError) {
        return reply.status(409).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.get("/api/warehouses/:id/locations", async (request, reply) => {
    const params = warehouseIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid warehouse ID",
      });
    }

    try {
      const data = await warehouseService.listLocations(params.data.id);

      return { data };
    } catch (error) {
      if (error instanceof WarehouseNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post("/api/warehouses/:id/locations", async (request, reply) => {
    const params = warehouseIdSchema.safeParse(request.params);
    const body = createLocationSchema.safeParse(request.body);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid warehouse ID",
      });
    }

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid location data",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await warehouseService.createLocation(
        params.data.id,
        body.data,
      );

      return reply.status(201).send({ data });
    } catch (error) {
      if (error instanceof WarehouseNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      if (error instanceof LocationCodeAlreadyExistsError) {
        return reply.status(409).send({
          error: error.message,
        });
      }

      throw error;
    }
  });
}
