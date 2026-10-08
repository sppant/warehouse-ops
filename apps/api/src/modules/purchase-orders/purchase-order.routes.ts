import type { FastifyInstance } from "fastify";
import {
  createPurchaseOrderSchema,
  purchaseOrderIdSchema,
  updatePurchaseOrderStatusSchema,
  receivePurchaseOrderItemSchema,
} from "./purchase-order.schema.js";
import {
  ProductNotFoundError,
  PurchaseOrderAlreadyExistsError,
  PurchaseOrderNotFoundError,
  PurchaseOrderItemNotFoundError,
  InvalidPurchaseOrderReceiptError,
  purchaseOrderService,
} from "./purchase-order.service.js";

export async function purchaseOrderRoutes(app: FastifyInstance) {
  app.get("/api/purchase-orders", async () => {
    const data = await purchaseOrderService.list();

    return { data };
  });

  app.get("/api/purchase-orders/:id", async (request, reply) => {
    const params = purchaseOrderIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid purchase order ID",
        details: params.error.flatten(),
      });
    }

    try {
      const data = await purchaseOrderService.get(params.data.id);

      return { data };
    } catch (error) {
      if (error instanceof PurchaseOrderNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post("/api/purchase-orders", async (request, reply) => {
    const body = createPurchaseOrderSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid purchase order data",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await purchaseOrderService.create(body.data);

      return reply.status(201).send({ data });
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      if (error instanceof PurchaseOrderAlreadyExistsError) {
        return reply.status(409).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.patch("/api/purchase-orders/:id/status", async (request, reply) => {
    const params = purchaseOrderIdSchema.safeParse(request.params);
    const body = updatePurchaseOrderStatusSchema.safeParse(request.body);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid purchase order ID",
        details: params.error.flatten(),
      });
    }

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid purchase order status",
        details: body.error.flatten(),
      });
    }

    try {
      const data = await purchaseOrderService.updateStatus(
        params.data.id,
        body.data,
      );

      return { data };
    } catch (error) {
      if (error instanceof PurchaseOrderNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post(
    "/api/purchase-orders/items/:itemId/receive",
    async (request, reply) => {
      const params = request.params as { itemId?: string };
      const body = receivePurchaseOrderItemSchema.safeParse(request.body);

      if (!params.itemId) {
        return reply.status(400).send({
          error: "Invalid purchase order item ID",
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          error: "Invalid receiving data",
          details: body.error.flatten(),
        });
      }

      try {
        const data = await purchaseOrderService.receiveItem({
          ...body.data,
          purchaseOrderItemId: params.itemId,
        });

        return reply.status(201).send({ data });
      } catch (error) {
        if (error instanceof PurchaseOrderItemNotFoundError) {
          return reply.status(404).send({
            error: error.message,
          });
        }

        if (error instanceof InvalidPurchaseOrderReceiptError) {
          return reply.status(400).send({
            error: error.message,
          });
        }

        throw error;
      }
    },
  );
}
