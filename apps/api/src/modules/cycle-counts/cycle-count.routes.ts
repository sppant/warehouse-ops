import type { FastifyInstance } from "fastify";
import {
  cycleCountIdSchema,
  recordCycleCountSchema,
} from "./cycle-count.schema.js";
import {
  CycleCountNotFoundError,
  InvalidCycleCountStateError,
  LocationNotFoundError,
  ProductNotFoundError,
  cycleCountService,
} from "./cycle-count.service.js";

export async function cycleCountRoutes(app: FastifyInstance) {
  app.get("/api/cycle-counts", async () => {
    const data = await cycleCountService.list();

    return { data };
  });

  app.get("/api/cycle-counts/:id", async (request, reply) => {
    const params = cycleCountIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid cycle count ID",
        details: params.error.flatten(),
      });
    }

    try {
      const data = await cycleCountService.get(params.data.id);

      return { data };
    } catch (error) {
      if (error instanceof CycleCountNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post("/api/cycle-counts", async (request, reply) => {
    const body = recordCycleCountSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid cycle count data",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await cycleCountService.record(body.data);

      return reply.status(201).send({ data });
    } catch (error) {
      if (
        error instanceof ProductNotFoundError ||
        error instanceof LocationNotFoundError
      ) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  registerReviewRoute(
    app,
    "/api/cycle-counts/:id/approve",
    cycleCountService.approve,
  );

  registerReviewRoute(
    app,
    "/api/cycle-counts/:id/reject",
    cycleCountService.reject,
  );
}

function registerReviewRoute(
  app: FastifyInstance,
  path: string,
  review: (id: string) => Promise<unknown>,
) {
  app.post(path, async (request, reply) => {
    const params = cycleCountIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid cycle count ID",
        details: params.error.flatten(),
      });
    }

    try {
      const data = await review(params.data.id);

      return { data };
    } catch (error) {
      if (error instanceof CycleCountNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      if (error instanceof InvalidCycleCountStateError) {
        return reply.status(400).send({
          error: error.message,
        });
      }

      throw error;
    }
  });
}
