import type { FastifyInstance } from "fastify";
import {
  createSalesOrderSchema,
  salesOrderIdSchema,
} from "./sales-order.schema.js";
import {
  ProductNotFoundError,
  SalesOrderAlreadyExistsError,
  SalesOrderNotFoundError,
  salesOrderService,
} from "./sales-order.service.js";

export async function salesOrderRoutes(app: FastifyInstance) {
  app.get("/api/sales-orders", async () => {
    const data = await salesOrderService.list();

    return { data };
  });

  app.get("/api/sales-orders/:id", async (request, reply) => {
    const params = salesOrderIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid sales order ID",
        details: params.error.flatten(),
      });
    }

    try {
      const data = await salesOrderService.get(params.data.id);

      return { data };
    } catch (error) {
      if (error instanceof SalesOrderNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post("/api/sales-orders", async (request, reply) => {
    const body = createSalesOrderSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid sales order data",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await salesOrderService.create(body.data);

      return reply.status(201).send({ data });
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      if (error instanceof SalesOrderAlreadyExistsError) {
        return reply.status(409).send({
          error: error.message,
        });
      }

      throw error;
    }
  });
}
