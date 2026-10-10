import type { FastifyInstance } from "fastify";
import {
  generatePickTaskSchema,
  pickTaskIdSchema,
} from "./pick-task.schema.js";
import {
  InsufficientInventoryError,
  InvalidSalesOrderStateError,
  PickTaskNotFoundError,
  SalesOrderNotFoundError,
  pickTaskService,
} from "./pick-task.service.js";

export async function pickTaskRoutes(app: FastifyInstance) {
  app.get("/api/pick-tasks", async () => {
    const data = await pickTaskService.list();

    return { data };
  });

  app.get("/api/pick-tasks/:id", async (request, reply) => {
    const params = pickTaskIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid pick task ID",
        details: params.error.flatten(),
      });
    }

    try {
      const data = await pickTaskService.get(params.data.id);

      return { data };
    } catch (error) {
      if (error instanceof PickTaskNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post("/api/pick-tasks", async (request, reply) => {
    const body = generatePickTaskSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid pick task data",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await pickTaskService.generate(body.data.salesOrderId);

      return reply.status(201).send({ data });
    } catch (error) {
      if (error instanceof SalesOrderNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      if (
        error instanceof InvalidSalesOrderStateError ||
        error instanceof InsufficientInventoryError
      ) {
        return reply.status(400).send({
          error: error.message,
        });
      }

      throw error;
    }
  });
}
