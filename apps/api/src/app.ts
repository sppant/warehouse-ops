import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { productRoutes } from "./modules/products/product.routes.js";

export const buildApp = () => {
  const app = Fastify({
    logger: false,
  });

  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  app.register(helmet);
  app.register(productRoutes);

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  return app;
};
