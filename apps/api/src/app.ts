import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { productRoutes } from "./modules/products/product.routes.js";
import { warehouseRoutes } from "./modules/warehouses/warehouse.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { purchaseOrderRoutes } from "./modules/purchase-orders/purchase-order.routes.js";
import { salesOrderRoutes } from "./modules/sales-orders/sales-order.routes.js";

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
  app.register(warehouseRoutes);
  app.register(inventoryRoutes);
  app.register(purchaseOrderRoutes);
  app.register(salesOrderRoutes);

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  return app;
};
