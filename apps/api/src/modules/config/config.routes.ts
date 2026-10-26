import type { FastifyInstance } from "fastify";
import type { FeatureFlags } from "../../config/flags.js";

export async function configRoutes(
  app: FastifyInstance,
  options: { flags: FeatureFlags },
) {
  app.get("/api/config/flags", async () => ({ data: options.flags }));
}
