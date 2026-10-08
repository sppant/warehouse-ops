import type { FastifyInstance } from "fastify";
import {
  createProductSchema,
  productIdSchema,
  updateProductSchema,
} from "./product.schema.js";
import {
  ProductNotFoundError,
  productService,
} from "./product.service.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products", async (request) => {
    const query = request.query as { search?: string };

    return {
      data: await productService.list(query.search),
    };
  });

  app.get("/api/products/:id", async (request, reply) => {
    const params = productIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid product ID",
      });
    }

    try {
      const product = await productService.getById(params.data.id);

      return {
        data: product,
      };
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });

  app.post("/api/products", async (request, reply) => {
    const result = createProductSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: "Invalid product data",
        details: result.error.flatten(),
      });
    }

    const product = await productService.create(result.data);

    return reply.status(201).send({
      data: product,
    });
  });

  app.patch("/api/products/:id", async (request, reply) => {
    const params = productIdSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "Invalid product ID",
      });
    }

    const body = updateProductSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid product data",
        details: body.error.flatten(),
      });
    }

    try {
      const product = await productService.update(
        params.data.id,
        body.data,
      );

      return {
        data: product,
      };
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({
          error: error.message,
        });
      }

      throw error;
    }
  });
}
